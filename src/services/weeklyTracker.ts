import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

export type WeeklyAttendance = "present" | "absent" | "unrecorded";
export type WeeklyMeetingStatus = "planned" | "open" | "closed";

export type WeeklyMemberEntry = {
  memberId: string;
  memberName: string;
  attendance: WeeklyAttendance;
  subsPaid: boolean;
  subsAmount: number;
  badges: string[];
};

export type WeeklyMedicalIssue = {
  memberId: string;
  memberName: string;
  details: string;
  actionTaken: string;
};

export type WeeklyMeetingRecord = {
  id: string;
  section: string;
  meetingDate: string;
  location: string;
  status: WeeklyMeetingStatus;
  plannedActivities: string[];
  plannedBadgework: string[];
  medicalIssues: WeeklyMedicalIssue[];
  notes: string;
  entries: WeeklyMemberEntry[];
};

export type WeeklyMeetingInput = Omit<WeeklyMeetingRecord, "id">;

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
export const DEFAULT_MEETING_LOCATION = "Scout Den";

function clean(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function cleanList(values: string[], maxItems: number, maxLength: number): string[] {
  return [...new Set(values.map((value) => clean(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function cleanEntry(entry: WeeklyMemberEntry): WeeklyMemberEntry {
  return {
    memberId: clean(entry.memberId, 160),
    memberName: clean(entry.memberName, 160),
    attendance: ["present", "absent", "unrecorded"].includes(entry.attendance) ? entry.attendance : "unrecorded",
    subsPaid: entry.subsPaid === true,
    subsAmount: Number.isFinite(entry.subsAmount) ? Math.max(0, Math.min(1000, Number(entry.subsAmount.toFixed(2)))) : 0,
    badges: cleanList(entry.badges, 20, 120)
  };
}

function cleanMedicalIssue(issue: WeeklyMedicalIssue): WeeklyMedicalIssue {
  return {
    memberId: clean(issue.memberId, 160),
    memberName: clean(issue.memberName, 160),
    details: clean(issue.details, 1200),
    actionTaken: clean(issue.actionTaken, 1200)
  };
}

function cleanInput(input: WeeklyMeetingInput): WeeklyMeetingInput {
  return {
    section: clean(input.section, 80),
    meetingDate: clean(input.meetingDate, 20),
    location: clean(input.location || DEFAULT_MEETING_LOCATION, 240) || DEFAULT_MEETING_LOCATION,
    status: ["planned", "open", "closed"].includes(input.status) ? input.status : "planned",
    plannedActivities: cleanList(input.plannedActivities, 30, 240),
    plannedBadgework: cleanList(input.plannedBadgework, 30, 240),
    medicalIssues: input.medicalIssues.map(cleanMedicalIssue).filter((issue) => issue.memberId && issue.memberName && issue.details).slice(0, 50),
    notes: clean(input.notes, 4000),
    entries: input.entries.map(cleanEntry).filter((entry) => entry.memberId && entry.memberName).slice(0, 100)
  };
}

function mapEntry(value: unknown): WeeklyMemberEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const memberId = typeof data.memberId === "string" ? data.memberId.trim() : "";
  const memberName = typeof data.memberName === "string" ? data.memberName.trim() : "";
  const attendance = data.attendance as WeeklyAttendance;
  if (!memberId || !memberName || !["present", "absent", "unrecorded"].includes(attendance)) return null;
  if (!Array.isArray(data.badges) || !data.badges.every((item) => typeof item === "string")) return null;
  if (typeof data.subsPaid !== "boolean" || typeof data.subsAmount !== "number" || !Number.isFinite(data.subsAmount)) return null;
  return { memberId, memberName, attendance, subsPaid: data.subsPaid, subsAmount: data.subsAmount, badges: data.badges.map((item) => item.trim()).filter(Boolean) };
}

function mapMedicalIssue(value: unknown): WeeklyMedicalIssue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const memberId = typeof data.memberId === "string" ? data.memberId.trim() : "";
  const memberName = typeof data.memberName === "string" ? data.memberName.trim() : "";
  const details = typeof data.details === "string" ? data.details.trim() : "";
  const actionTaken = typeof data.actionTaken === "string" ? data.actionTaken.trim() : "";
  return memberId && memberName && details ? { memberId, memberName, details, actionTaken } : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value.map((item) => item.trim()).filter(Boolean) : [];
}

function mapRecord(snapshot: QueryDocumentSnapshot<DocumentData>): WeeklyMeetingRecord | null {
  const data = snapshot.data();
  const section = typeof data.section === "string" ? data.section.trim() : "";
  const meetingDate = typeof data.meetingDate === "string" ? data.meetingDate.trim() : "";
  if (!section || !meetingDate || !Array.isArray(data.entries)) return null;
  const entries = data.entries.map(mapEntry);
  if (entries.some((entry) => entry === null)) return null;
  const rawIssues = Array.isArray(data.medicalIssues) ? data.medicalIssues.map(mapMedicalIssue) : [];
  const status: WeeklyMeetingStatus = ["planned", "open", "closed"].includes(data.status) ? data.status : "closed";
  return {
    id: snapshot.id,
    section,
    meetingDate,
    location: typeof data.location === "string" && data.location.trim() ? data.location.trim() : DEFAULT_MEETING_LOCATION,
    status,
    plannedActivities: stringList(data.plannedActivities),
    plannedBadgework: stringList(data.plannedBadgework),
    medicalIssues: rawIssues.filter((issue): issue is WeeklyMedicalIssue => issue !== null),
    notes: typeof data.notes === "string" ? data.notes.trim() : "",
    entries: entries as WeeklyMemberEntry[]
  };
}

function validRecords(docs: QueryDocumentSnapshot<DocumentData>[]): WeeklyMeetingRecord[] {
  return docs.map(mapRecord).filter((record): record is WeeklyMeetingRecord => record !== null);
}

export async function loadWeeklyMeetings(sections: string[], canManageAllSections: boolean): Promise<WeeklyMeetingRecord[]> {
  const requestedSections = canManageAllSections ? GROUP_SECTIONS : [...new Set(sections.map((section) => section.trim()).filter(Boolean))];
  if (requestedSections.length === 0) return [];
  const snapshots = await Promise.all(requestedSections.map((section) => getDocs(query(collection(db, "weeklyMeetings"), where("section", "==", section)))));
  return validRecords(snapshots.flatMap((snapshot) => snapshot.docs)).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

export async function createWeeklyMeeting(input: WeeklyMeetingInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  const cleaned = cleanInput(input);
  if (!cleaned.section || !cleaned.meetingDate) throw new Error("Weekly meeting does not match the canonical data contract.");
  const result = await addDoc(collection(db, "weeklyMeetings"), { ...cleaned, createdBy: user.uid, createdAt: serverTimestamp(), updatedBy: user.uid, updatedAt: serverTimestamp() });
  return result.id;
}

export async function updateWeeklyMeeting(id: string, input: WeeklyMeetingInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  const cleaned = cleanInput(input);
  if (!cleaned.section || !cleaned.meetingDate) throw new Error("Weekly meeting does not match the canonical data contract.");
  await updateDoc(doc(db, "weeklyMeetings", id), { ...cleaned, updatedBy: user.uid, updatedAt: serverTimestamp() });
}

export async function copyWeeklyMeeting(source: WeeklyMeetingRecord, meetingDate: string, entries: WeeklyMemberEntry[]): Promise<string> {
  return createWeeklyMeeting({
    section: source.section,
    meetingDate,
    location: source.location || DEFAULT_MEETING_LOCATION,
    status: meetingDate > new Date().toISOString().slice(0, 10) ? "planned" : "open",
    plannedActivities: source.plannedActivities,
    plannedBadgework: source.plannedBadgework,
    medicalIssues: [],
    notes: "",
    entries: entries.map((entry) => ({ ...entry, attendance: "unrecorded", subsPaid: false, subsAmount: 0, badges: [] }))
  });
}
