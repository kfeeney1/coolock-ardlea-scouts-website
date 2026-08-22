import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
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
  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  return null;
}

function stringValue(data: DocumentData, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

function mapMeeting(snapshot: QueryDocumentSnapshot<DocumentData>): MeetingRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: stringValue(data, "title") || "Untitled meeting",
    meetingType: data.meetingType === "group" ? "group" : "leader",
    section: stringValue(data, "section"),
    meetingDate: stringValue(data, "meetingDate"),
    attendees: stringArray(data.attendees),
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

export async function loadMeetingRecords(sections: string[], isAdmin: boolean): Promise<MeetingRecord[]> {
  if (isAdmin) {
    const snapshot = await getDocs(query(collection(db, "meetingRecords"), orderBy("meetingDate", "desc")));
    return snapshot.docs.map(mapMeeting);
  }

  if (sections.length === 0) return [];
  const snapshots = await Promise.all(sections.map((section) => getDocs(query(
    collection(db, "meetingRecords"),
    where("section", "==", section),
    orderBy("meetingDate", "desc")
  ))));

  return snapshots.flatMap((snapshot) => snapshot.docs.map(mapMeeting))
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

export async function createMeetingRecord(input: MeetingInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  const cleaned = cleanInput(input);
  const result = await addDoc(collection(db, "meetingRecords"), {
    ...cleaned,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });
  return result.id;
}

export async function updateMeetingRecord(id: string, input: MeetingInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  await updateDoc(doc(db, "meetingRecords", id), {
    ...cleanInput(input),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });
}
