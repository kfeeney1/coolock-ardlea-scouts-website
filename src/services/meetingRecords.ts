import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export type MeetingType = "group" | "leader";

export type MeetingRecord = {
  id: string;
  title: string;
  meetingType: MeetingType;
  section: string;
  meetingDate: string;
  attendees: string[];
  notes: string;
  decisions: string;
  actions: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type MeetingInput = Omit<MeetingRecord, "id" | "createdAt" | "updatedAt">;

function timestampToDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate();
  return null;
}

function stringValue(data: DocumentData, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === "string")
    ? value.map((item) => item.trim()).filter(Boolean)
    : null;
}

function mapMeeting(snapshot: QueryDocumentSnapshot<DocumentData>): MeetingRecord | null {
  const data = snapshot.data();
  const title = stringValue(data, "title");
  const meetingType = data.meetingType as MeetingType;
  const section = stringValue(data, "section");
  const meetingDate = stringValue(data, "meetingDate");
  const attendees = stringArray(data.attendees);
  if (!title || !["group", "leader"].includes(meetingType) || !section || !meetingDate || !attendees) return null;
  if (meetingType === "group" && section !== "Group") return null;
  if ("date" in data || "actionItems" in data) return null;

  return {
    id: snapshot.id,
    title,
    meetingType,
    section,
    meetingDate,
    attendees,
    notes: stringValue(data, "notes"),
    decisions: stringValue(data, "decisions"),
    actions: stringValue(data, "actions"),
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt)
  };
}

function clean(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function validMeetings(docs: QueryDocumentSnapshot<DocumentData>[]): MeetingRecord[] {
  return docs.map(mapMeeting).filter((meeting): meeting is MeetingRecord => meeting !== null);
}

function newestFirst(meetings: MeetingRecord[]): MeetingRecord[] {
  return meetings.sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

export async function loadMeetingRecords(sections: string[], isAdmin: boolean): Promise<MeetingRecord[]> {
  if (isAdmin) {
    // Keep admin reads constrained to the canonical meeting types. A broad collection
    // query can be rejected by Firestore rules if even one stale/legacy document in
    // the collection falls outside the current access contract.
    const [groupSnapshot, leaderSnapshot] = await Promise.all([
      getDocs(query(collection(db, "meetingRecords"), where("meetingType", "==", "group"))),
      getDocs(query(collection(db, "meetingRecords"), where("meetingType", "==", "leader")))
    ]);
    return newestFirst(validMeetings([...groupSnapshot.docs, ...leaderSnapshot.docs]));
  }

  const uniqueSections = [...new Set(sections.map((section) => section.trim()).filter(Boolean))];
  if (uniqueSections.length === 0) return [];
  const snapshots = await Promise.all(uniqueSections.map((section) => getDocs(query(
    collection(db, "meetingRecords"),
    where("meetingType", "==", "leader"),
    where("section", "==", section)
  ))));

  return newestFirst(validMeetings(snapshots.flatMap((snapshot) => snapshot.docs)));
}

export async function createMeetingRecord(input: MeetingInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  const cleaned = cleanInput(input);
  if (!cleaned.title || !cleaned.meetingDate || !cleaned.section) throw new Error("Meeting does not match the canonical data contract.");
  const result = await addDoc(collection(db, "meetingRecords"), {
    ...cleaned,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });
  return result.id;
}

function cleanInput(input: MeetingInput): MeetingInput {
  return {
    title: clean(input.title, 200),
    meetingType: input.meetingType,
    section: input.meetingType === "group" ? "Group" : clean(input.section, 80),
    meetingDate: clean(input.meetingDate, 30),
    attendees: input.attendees.map((name) => clean(name, 120)).filter(Boolean).slice(0, 60),
    notes: clean(input.notes, 12000),
    decisions: clean(input.decisions, 8000),
    actions: clean(input.actions, 8000)
  };
}

export async function updateMeetingRecord(id: string, input: MeetingInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  const cleaned = cleanInput(input);
  if (!cleaned.title || !cleaned.meetingDate || !cleaned.section) throw new Error("Meeting does not match the canonical data contract.");
  await updateDoc(doc(db, "meetingRecords", id), {
    ...cleaned,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });
}
