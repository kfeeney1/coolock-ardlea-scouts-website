import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
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
  location: string;
  plannedActivities: string;
  plannedBadgework: string;
  programmeNotes: string;
  notes: string;
  entries: WeeklyMemberEntry[];
};

export type WeeklyMeetingInput = Omit<WeeklyMeetingRecord, "id">;

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const PLAN_VERSION = 1;
const PLAN_MARKER = "weekly-plan-v1";

type StoredWeeklyNotes = {
  marker: typeof PLAN_MARKER;
  version: typeof PLAN_VERSION;
  location: string;
  plannedActivities: string;
  plannedBadgework: string;
  programmeNotes: string;
  postMeetingNotes: string;
};

const emptyPlan = {
  location: "",
  plannedActivities: "",
  plannedBadgework: "",
  programmeNotes: "",
  notes: ""
};

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
    location: clean(input.location, 240),
    plannedActivities: clean(input.plannedActivities, 4000),
    plannedBadgework: clean(input.plannedBadgework, 4000),
    programmeNotes: clean(input.programmeNotes, 4000),
    notes: clean(input.notes, 4000),
    entries: input.entries.map(cleanEntry).filter((entry) => entry.memberId && entry.memberName).slice(0, 100)
  };
}

function encodeNotes(input: WeeklyMeetingInput): string {
  const stored: StoredWeeklyNotes = {
    marker: PLAN_MARKER,
    version: PLAN_VERSION,
    location: input.location,
    plannedActivities: input.plannedActivities,
    plannedBadgework: input.plannedBadgework,
    programmeNotes: input.programmeNotes,
    postMeetingNotes: input.notes
  };
  return JSON.stringify(stored);
}

function decodeNotes(value: unknown): Omit<WeeklyMeetingRecord, "id" | "section" | "meetingDate" | "entries"> {
  if (typeof value !== "string") return emptyPlan;
  const raw = value.trim();
  if (!raw) return emptyPlan;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredWeeklyNotes>;
    if (parsed.marker !== PLAN_MARKER || parsed.version !== PLAN_VERSION) return { ...emptyPlan, notes: raw };
    return {
      location: typeof parsed.location === "string" ? parsed.location.trim() : "",
      plannedActivities: typeof parsed.plannedActivities === "string" ? parsed.plannedActivities.trim() : "",
      plannedBadgework: typeof parsed.plannedBadgework === "string" ? parsed.plannedBadgework.trim() : "",
      programmeNotes: typeof parsed.programmeNotes === "string" ? parsed.programmeNotes.trim() : "",
      notes: typeof parsed.postMeetingNotes === "string" ? parsed.postMeetingNotes.trim() : ""
    };
  } catch {
    return { ...emptyPlan, notes: raw };
  }
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
  return {
    memberId,
    memberName,
    attendance,
    subsPaid: data.subsPaid,
    subsAmount: data.subsAmount,
    badges: data.badges.map((item) => item.trim()).filter(Boolean)
  };
}

function mapRecord(snapshot: QueryDocumentSnapshot<DocumentData>): WeeklyMeetingRecord | null {
  const data = snapshot.data();
  const section = typeof data.section === "string" ? data.section.trim() : "";
  const meetingDate = typeof data.meetingDate === "string" ? data.meetingDate.trim() : "";
  if (!section || !meetingDate || !Array.isArray(data.entries)) return null;
  const entries = data.entries.map(mapEntry);
  if (entries.some((entry) => entry === null)) return null;
  return {
    id: snapshot.id,
    section,
    meetingDate,
    ...decodeNotes(data.notes),
    entries: entries as WeeklyMemberEntry[]
  };
}

function validRecords(docs: QueryDocumentSnapshot<DocumentData>[]): WeeklyMeetingRecord[] {
  return docs.map(mapRecord).filter((record): record is WeeklyMeetingRecord => record !== null);
}

export async function loadWeeklyMeetings(sections: string[], isAdmin: boolean): Promise<WeeklyMeetingRecord[]> {
  const requestedSections = isAdmin
    ? GROUP_SECTIONS
    : [...new Set(sections.map((section) => section.trim()).filter(Boolean))];
  if (requestedSections.length === 0) return [];

  const snapshots = await Promise.all(requestedSections.map((section) => getDocs(query(
    collection(db, "weeklyMeetings"),
    where("section", "==", section)
  ))));

  return validRecords(snapshots.flatMap((snapshot) => snapshot.docs))
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

export async function createWeeklyMeeting(input: WeeklyMeetingInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  const cleaned = cleanInput(input);
  if (!cleaned.section || !cleaned.meetingDate) throw new Error("Weekly meeting does not match the canonical data contract.");
  const result = await addDoc(collection(db, "weeklyMeetings"), {
    section: cleaned.section,
    meetingDate: cleaned.meetingDate,
    notes: encodeNotes(cleaned),
    entries: cleaned.entries,
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
  const cleaned = cleanInput(input);
  if (!cleaned.section || !cleaned.meetingDate) throw new Error("Weekly meeting does not match the canonical data contract.");
  await updateDoc(doc(db, "weeklyMeetings", id), {
    section: cleaned.section,
    meetingDate: cleaned.meetingDate,
    notes: encodeNotes(cleaned),
    entries: cleaned.entries,
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  });
}
