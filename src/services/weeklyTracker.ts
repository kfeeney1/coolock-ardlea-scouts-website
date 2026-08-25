import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

export type WeeklyAttendance = "present" | "absent" | "unrecorded";
export type WeeklyMeetingStatus = "open" | "closed";
export type InjurySeverity = "minor" | "moderate" | "serious";

export type WeeklyMemberEntry = {
  memberId: string;
  memberName: string;
  attendance: WeeklyAttendance;
  subsPaid: boolean;
  subsAmount: number;
  badges: string[];
};

export type WeeklyInjury = {
  memberId: string;
  memberName: string;
  concern: string;
  severity: InjurySeverity;
  actionTaken: string;
  parentInformed: boolean;
  recordedAt: string;
};

export type WeeklyMeetingRecord = {
  id: string;
  section: string;
  meetingDate: string;
  status: WeeklyMeetingStatus;
  location: string;
  plannedActivities: string;
  plannedBadgework: string;
  programmeNotes: string;
  notes: string;
  entries: WeeklyMemberEntry[];
  injuries: WeeklyInjury[];
};

export type WeeklyMeetingInput = Omit<WeeklyMeetingRecord, "id">;
export type WeeklyAccess = { scoutingRole: string; canViewAll: boolean; canEditAll: boolean; readOnly: boolean };

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const LEGACY_PLAN_MARKER = "weekly-plan-v1";

function clean(value: string, max: number): string { return value.trim().slice(0, max); }

function cleanEntry(entry: WeeklyMemberEntry): WeeklyMemberEntry {
  return {
    memberId: clean(entry.memberId, 160), memberName: clean(entry.memberName, 160), attendance: entry.attendance,
    subsPaid: entry.subsPaid === true,
    subsAmount: Number.isFinite(entry.subsAmount) ? Math.max(0, Math.min(1000, Number(entry.subsAmount.toFixed(2)))) : 0,
    badges: [...new Set(entry.badges.map((badge) => clean(badge, 120)).filter(Boolean))].slice(0, 20)
  };
}

function cleanInjury(injury: WeeklyInjury): WeeklyInjury {
  return {
    memberId: clean(injury.memberId, 160), memberName: clean(injury.memberName, 160), concern: clean(injury.concern, 2000),
    severity: ["minor", "moderate", "serious"].includes(injury.severity) ? injury.severity : "minor",
    actionTaken: clean(injury.actionTaken, 2000), parentInformed: injury.parentInformed === true,
    recordedAt: clean(injury.recordedAt, 40)
  };
}

function cleanInput(input: WeeklyMeetingInput): WeeklyMeetingInput {
  return {
    section: clean(input.section, 80), meetingDate: clean(input.meetingDate, 20), status: input.status === "closed" ? "closed" : "open",
    location: clean(input.location, 240), plannedActivities: clean(input.plannedActivities, 4000), plannedBadgework: clean(input.plannedBadgework, 4000),
    programmeNotes: clean(input.programmeNotes, 4000), notes: clean(input.notes, 4000),
    entries: input.entries.map(cleanEntry).filter((entry) => entry.memberId && entry.memberName).slice(0, 100),
    injuries: input.injuries.map(cleanInjury).filter((item) => item.memberId && item.memberName && item.concern).slice(0, 50)
  };
}

function mapEntry(value: unknown): WeeklyMemberEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>; const memberId = typeof data.memberId === "string" ? data.memberId.trim() : ""; const memberName = typeof data.memberName === "string" ? data.memberName.trim() : "";
  const attendance = data.attendance as WeeklyAttendance;
  if (!memberId || !memberName || !["present", "absent", "unrecorded"].includes(attendance)) return null;
  return { memberId, memberName, attendance, subsPaid: data.subsPaid === true, subsAmount: typeof data.subsAmount === "number" ? data.subsAmount : 0, badges: Array.isArray(data.badges) ? data.badges.filter((x): x is string => typeof x === "string") : [] };
}

function mapInjury(value: unknown): WeeklyInjury | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>; const memberId = typeof data.memberId === "string" ? data.memberId.trim() : ""; const memberName = typeof data.memberName === "string" ? data.memberName.trim() : ""; const concern = typeof data.concern === "string" ? data.concern.trim() : "";
  if (!memberId || !memberName || !concern) return null;
  const severity = data.severity as InjurySeverity;
  return { memberId, memberName, concern, severity: ["minor", "moderate", "serious"].includes(severity) ? severity : "minor", actionTaken: typeof data.actionTaken === "string" ? data.actionTaken.trim() : "", parentInformed: data.parentInformed === true, recordedAt: typeof data.recordedAt === "string" ? data.recordedAt : "" };
}

function legacyNotes(value: unknown) {
  const empty = { location: "", plannedActivities: "", plannedBadgework: "", programmeNotes: "", notes: "" };
  if (typeof value !== "string" || !value.trim()) return empty;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.marker !== LEGACY_PLAN_MARKER) return { ...empty, notes: value.trim() };
    return { location: typeof parsed.location === "string" ? parsed.location : "", plannedActivities: typeof parsed.plannedActivities === "string" ? parsed.plannedActivities : "", plannedBadgework: typeof parsed.plannedBadgework === "string" ? parsed.plannedBadgework : "", programmeNotes: typeof parsed.programmeNotes === "string" ? parsed.programmeNotes : "", notes: typeof parsed.postMeetingNotes === "string" ? parsed.postMeetingNotes : "" };
  } catch { return { ...empty, notes: value.trim() }; }
}

function mapRecord(snapshot: QueryDocumentSnapshot<DocumentData>): WeeklyMeetingRecord | null {
  const data = snapshot.data(); const section = typeof data.section === "string" ? data.section.trim() : ""; const meetingDate = typeof data.meetingDate === "string" ? data.meetingDate.trim() : "";
  if (!section || !meetingDate || !Array.isArray(data.entries)) return null;
  const entries = data.entries.map(mapEntry); if (entries.some((entry) => entry === null)) return null;
  const legacy = legacyNotes(data.notes);
  const injuries = Array.isArray(data.injuries) ? data.injuries.map(mapInjury).filter((x): x is WeeklyInjury => x !== null) : [];
  return {
    id: snapshot.id, section, meetingDate, status: data.status === "open" ? "open" : "closed",
    location: typeof data.location === "string" ? data.location.trim() : legacy.location,
    plannedActivities: typeof data.plannedActivities === "string" ? data.plannedActivities.trim() : legacy.plannedActivities,
    plannedBadgework: typeof data.plannedBadgework === "string" ? data.plannedBadgework.trim() : legacy.plannedBadgework,
    programmeNotes: typeof data.programmeNotes === "string" ? data.programmeNotes.trim() : legacy.programmeNotes,
    notes: typeof data.notes === "string" && data.keys && false ? "" : (typeof data.postMeetingNotes === "string" ? data.postMeetingNotes.trim() : legacy.notes),
    entries: entries as WeeklyMemberEntry[], injuries
  };
}

export async function loadWeeklyAccess(): Promise<WeeklyAccess> {
  const user = auth.currentUser; if (!user) return { scoutingRole: "", canViewAll: false, canEditAll: false, readOnly: false };
  const snap = await getDoc(doc(db, "organisationLeadership", user.uid));
  const role = snap.exists() && typeof snap.data().scoutingRole === "string" ? snap.data().scoutingRole : "";
  return { scoutingRole: role, canViewAll: ["Group Leader", "Group Secretary"].includes(role), canEditAll: role === "Group Leader", readOnly: role === "Group Secretary" };
}

export async function loadWeeklyMeetings(sections: string[], isAdmin: boolean, canViewAll = false): Promise<WeeklyMeetingRecord[]> {
  const requested = (isAdmin || canViewAll) ? GROUP_SECTIONS : [...new Set(sections.map((s) => s.trim()).filter(Boolean))];
  if (!requested.length) return [];
  const snapshots = await Promise.all(requested.map((section) => getDocs(query(collection(db, "weeklyMeetings"), where("section", "==", section)))));
  return snapshots.flatMap((s) => s.docs).map(mapRecord).filter((r): r is WeeklyMeetingRecord => r !== null).sort((a,b) => b.meetingDate.localeCompare(a.meetingDate));
}

export async function createWeeklyMeeting(input: WeeklyMeetingInput): Promise<string> {
  const user = auth.currentUser; if (!user) throw new Error("Leader authentication is required."); const cleaned = cleanInput(input);
  const result = await addDoc(collection(db, "weeklyMeetings"), { ...cleaned, createdBy: user.uid, createdAt: serverTimestamp(), updatedBy: user.uid, updatedAt: serverTimestamp() }); return result.id;
}

export async function updateWeeklyMeeting(id: string, input: WeeklyMeetingInput): Promise<void> {
  const user = auth.currentUser; if (!user) throw new Error("Leader authentication is required."); const cleaned = cleanInput(input);
  await updateDoc(doc(db, "weeklyMeetings", id), { ...cleaned, updatedBy: user.uid, updatedAt: serverTimestamp() });
}
