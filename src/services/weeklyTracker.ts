import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

export type WeeklyAttendance = "present" | "absent" | "unrecorded";

export type WeeklyMemberEntry = {
  memberId: string;
  memberName: string;
  attendance: WeeklyAttendance;
  subsPaid: boolean;
  subsAmount: number;
  badges: string[];
};

export type WeeklyMeetingRecord = {
  id: string;
  section: string;
  meetingDate: string;
  notes: string;
  entries: WeeklyMemberEntry[];
};

export type WeeklyMeetingInput = Omit<WeeklyMeetingRecord, "id">;

function clean(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function cleanEntry(entry: WeeklyMemberEntry): WeeklyMemberEntry {
  return {
    memberId: clean(entry.memberId, 160),
    memberName: clean(entry.memberName, 160),
    attendance: entry.attendance,
    subsPaid: entry.subsPaid === true,
    subsAmount: Number.isFinite(entry.subsAmount) ? Math.max(0, Math.min(1000, Number(entry.subsAmount.toFixed(2)))) : 0,
    badges: [...new Set(entry.badges.map((badge) => clean(badge, 120)).filter(Boolean))].slice(0, 20)
  };
}

function cleanInput(input: WeeklyMeetingInput): WeeklyMeetingInput {
  return {
    section: clean(input.section, 80),
    meetingDate: clean(input.meetingDate, 20),
    notes: clean(input.notes, 4000),
    entries: input.entries.map(cleanEntry).filter((entry) => entry.memberId && entry.memberName).slice(0, 100)
  };
}

function mapEntry(value: unknown): WeeklyMemberEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const memberId = typeof data.memberId === "string" ? data.memberId.trim() : "";
  const memberName = typeof data.memberName === "string" ? data.memberName.trim() : "";
  if (!memberId || !memberName) return null;
  const attendance: WeeklyAttendance = data.attendance === "present" || data.attendance === "absent" ? data.attendance : "unrecorded";
  const badges = Array.isArray(data.badges) ? data.badges.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
  return {
    memberId,
    memberName,
    attendance,
    subsPaid: data.subsPaid === true,
    subsAmount: typeof data.subsAmount === "number" && Number.isFinite(data.subsAmount) ? data.subsAmount : 0,
    badges
  };
}

function mapRecord(snapshot: QueryDocumentSnapshot<DocumentData>): WeeklyMeetingRecord {
  const data = snapshot.data();
  const entries = Array.isArray(data.entries) ? data.entries.map(mapEntry).filter((entry): entry is WeeklyMemberEntry => entry !== null) : [];
  return {
    id: snapshot.id,
    section: typeof data.section === "string" ? data.section.trim() : "",
    meetingDate: typeof data.meetingDate === "string" ? data.meetingDate.trim() : "",
    notes: typeof data.notes === "string" ? data.notes.trim() : "",
    entries
  };
}

function sortByMeetingDate(records: WeeklyMeetingRecord[]): WeeklyMeetingRecord[] {
  return records.sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

export async function loadWeeklyMeetings(sections: string[], isAdmin: boolean): Promise<WeeklyMeetingRecord[]> {
  if (isAdmin) {
    const snapshot = await getDocs(query(collection(db, "weeklyMeetings"), orderBy("meetingDate", "desc")));
    return snapshot.docs.map(mapRecord);
  }
  const uniqueSections = [...new Set(sections.filter(Boolean))];
  if (uniqueSections.length === 0) return [];
  const snapshots = await Promise.all(uniqueSections.map((section) => getDocs(query(
    collection(db, "weeklyMeetings"),
    where("section", "==", section)
  ))));
  return sortByMeetingDate(snapshots.flatMap((snapshot) => snapshot.docs.map(mapRecord)));
}

export async function createWeeklyMeeting(input: WeeklyMeetingInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  const result = await addDoc(collection(db, "weeklyMeetings"), {
    ...cleanInput(input),
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  });
  return result.id;
}

export async function updateWeeklyMeeting(id: string, input: WeeklyMeetingInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  await updateDoc(doc(db, "weeklyMeetings", id), {
    ...cleanInput(input),
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  });
}
