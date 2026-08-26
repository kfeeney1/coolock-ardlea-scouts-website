import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import type { DocumentData, DocumentSnapshot, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export type MeetingType = "group" | "group-leaders" | "leader";

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

export type MeetingRecordVersion = Omit<MeetingRecord, "createdAt" | "updatedAt"> & {
  meetingId: string;
  versionedAt: Date | null;
  versionedBy: string;
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

function mapMeeting(snapshot: DocumentSnapshot<DocumentData>): MeetingRecord | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  const title = stringValue(data, "title");
  const meetingType = data.meetingType as MeetingType;
  const section = stringValue(data, "section");
  const meetingDate = stringValue(data, "meetingDate");
  const attendees = stringArray(data.attendees);
  if (!title || !["group", "group-leaders", "leader"].includes(meetingType) || !section || !meetingDate || !attendees) return null;
  if (["group", "group-leaders"].includes(meetingType) && section !== "Group") return null;
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

function mapVersion(snapshot: DocumentSnapshot<DocumentData>): MeetingRecordVersion | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  const meetingId = stringValue(data, "meetingId");
  const versionedBy = stringValue(data, "versionedBy");
  const meeting = mapMeeting(snapshot);
  if (!meetingId || !versionedBy || !meeting) return null;
  return {
    id: snapshot.id,
    meetingId,
    title: meeting.title,
    meetingType: meeting.meetingType,
    section: meeting.section,
    meetingDate: meeting.meetingDate,
    attendees: meeting.attendees,
    notes: meeting.notes,
    decisions: meeting.decisions,
    actions: meeting.actions,
    versionedAt: timestampToDate(data.versionedAt),
    versionedBy
  };
}

function clean(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function validMeetings(docs: DocumentSnapshot<DocumentData>[]): MeetingRecord[] {
  return docs.map(mapMeeting).filter((meeting): meeting is MeetingRecord => meeting !== null);
}

function newestFirst(meetings: MeetingRecord[]): MeetingRecord[] {
  return meetings.sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

export async function loadMeetingRecords(sections: string[], hasFullHistoryAccess: boolean): Promise<MeetingRecord[]> {
  if (hasFullHistoryAccess) {
    const snapshots = await Promise.all(["group", "group-leaders", "leader"].map((meetingType) =>
      getDocs(query(collection(db, "meetingRecords"), where("meetingType", "==", meetingType)))
    ));
    return newestFirst(validMeetings(snapshots.flatMap((snapshot) => snapshot.docs)));
  }

  const uniqueSections = [...new Set(sections.map((section) => section.trim()).filter(Boolean))];
  const [groupLeadersSnapshot, ...leaderSnapshots] = await Promise.all([
    getDocs(query(collection(db, "meetingRecords"), where("meetingType", "==", "group-leaders"))),
    ...uniqueSections.map((section) => getDocs(query(
      collection(db, "meetingRecords"),
      where("meetingType", "==", "leader"),
      where("section", "==", section)
    )))
  ]);
  return newestFirst(validMeetings([...groupLeadersSnapshot.docs, ...leaderSnapshots.flatMap((snapshot) => snapshot.docs)]));
}

export async function loadMeetingRecordVersions(meetingId: string): Promise<MeetingRecordVersion[]> {
  const snapshot = await getDocs(query(collection(db, "meetingRecordVersions"), where("meetingId", "==", meetingId)));
  return snapshot.docs
    .map(mapVersion)
    .filter((version): version is MeetingRecordVersion => version !== null)
    .sort((a, b) => (b.versionedAt?.getTime() ?? 0) - (a.versionedAt?.getTime() ?? 0));
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
    section: input.meetingType === "leader" ? clean(input.section, 80) : "Group",
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

  const recordRef = doc(db, "meetingRecords", id);
  const currentSnapshot = await getDoc(recordRef);
  const current = mapMeeting(currentSnapshot);
  if (!current) throw new Error("Existing meeting record does not match the canonical data contract.");

  const versionRef = doc(collection(db, "meetingRecordVersions"));
  const auditRef = doc(collection(db, "auditLog"));
  const batch = writeBatch(db);
  batch.set(versionRef, {
    meetingId: id,
    title: current.title,
    meetingType: current.meetingType,
    section: current.section,
    meetingDate: current.meetingDate,
    attendees: current.attendees,
    notes: current.notes,
    decisions: current.decisions,
    actions: current.actions,
    versionedAt: serverTimestamp(),
    versionedBy: user.uid
  });
  batch.update(recordRef, {
    ...cleaned,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });
  batch.set(auditRef, {
    category: "meeting-record",
    action: "update",
    actorUid: user.uid,
    actorEmail: user.email || "",
    targetId: id,
    targetLabel: cleaned.title,
    description: "Updated meeting record; previous version retained.",
    section: cleaned.section,
    createdAt: serverTimestamp()
  });
  await batch.commit();
}
