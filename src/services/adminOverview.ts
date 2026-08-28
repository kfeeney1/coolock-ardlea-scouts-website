import { collection, getCountFromServer, getDocs, query, where, type Query, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { AdminProfile } from "../components/admin/AdminAuthProvider";
import { buildLeaderToday, type LeaderAttentionItem, type LeaderTodayMeeting } from "./adminOverviewLogic";
import { canManageEquipment } from "./equipmentLogic";
import { incidentTypeLabel } from "./equipmentIncidentLogic";

export type AdminOverviewEvent = {
  id: string;
  title: string;
  section: string;
  startDate: string;
  status: string;
  consentRequired: boolean;
  outstandingConsent: number;
};

export type AdminOverview = {
  pendingParents: number;
  pendingLeaders: number;
  newJoinApplications: number;
  activeMembers: number;
  outstandingConsent: number;
  membersBySection: Array<{ section: string; count: number }>;
  upcomingEvents: AdminOverviewEvent[];
  nextMeeting: LeaderTodayMeeting | null;
  attentionItems: LeaderAttentionItem[];
};

type RawMember = { id: string; section: string; active: boolean };
type FirestoreSnapshot = QueryDocumentSnapshot;
type CacheEntry = { expiresAt: number; value: AdminOverview };

const OVERVIEW_CACHE_MS = 90_000;
const overviewCache = new Map<string, CacheEntry>();
const EVENT_STATUSES = new Set(["draft", "open", "closed", "completed"]);
const YOUTH_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isAdmin(profile: AdminProfile): boolean {
  return profile.role === "admin" || profile.role === "super-admin";
}

function cacheKey(profile: AdminProfile): string {
  return `${profile.role}:${profile.scoutingRole}:${[...new Set(profile.sections)].sort().join("|")}`;
}

function encodedProgrammeHasContent(value: unknown, itemField?: string): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (itemField && Array.isArray(parsed.items)) {
      return parsed.items.some((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>)[itemField] === "string" && String((item as Record<string, unknown>)[itemField]).trim().length > 0);
    }
    return [parsed.theme, parsed.notes].some((entry) => typeof entry === "string" && entry.trim().length > 0);
  } catch {
    return value.trim().length > 0;
  }
}

function mapMeeting(snapshot: FirestoreSnapshot): LeaderTodayMeeting | null {
  const data = snapshot.data();
  const section = stringValue(data.section);
  const meetingDate = stringValue(data.meetingDate);
  const status = stringValue(data.status) || "closed";
  if (!section || !meetingDate) return null;
  const entries = Array.isArray(data.entries) ? data.entries : [];
  return {
    id: snapshot.id,
    section,
    meetingDate,
    status,
    location: stringValue(data.location),
    programmeReady: encodedProgrammeHasContent(data.plannedActivities, "activity") || encodedProgrammeHasContent(data.plannedBadgework, "badge") || encodedProgrammeHasContent(data.programmeNotes),
    attendanceStarted: entries.some((entry) => entry && typeof entry === "object" && ["present", "absent"].includes(String((entry as Record<string, unknown>).attendance || "")))
  };
}

async function countDocuments(target: Query): Promise<number> {
  const snapshot = await getCountFromServer(target);
  return snapshot.data().count;
}

async function countScopedNewJoins(profile: AdminProfile): Promise<number> {
  if (isAdmin(profile)) return countDocuments(query(collection(db, "joinApplications"), where("status", "==", "new")));
  const sections = [...new Set(profile.sections.map((section) => section.trim()).filter(Boolean))];
  if (sections.length === 0) return 0;
  const counts = await Promise.all(sections.map((section) => countDocuments(query(collection(db, "joinApplications"), where("section", "==", section), where("status", "==", "new")))));
  return counts.reduce((total, count) => total + count, 0);
}

async function loadScopedCollection(collectionName: string, profile: AdminProfile): Promise<FirestoreSnapshot[]> {
  if (isAdmin(profile)) return (await getDocs(collection(db, collectionName))).docs;
  const sections = [...new Set(profile.sections.map((section) => section.trim()).filter(Boolean))];
  if (sections.length === 0) return [];
  const snapshots = await Promise.all(sections.map((section) => getDocs(query(collection(db, collectionName), where("section", "==", section)))));
  const byId = new Map<string, FirestoreSnapshot>();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((document) => byId.set(document.id, document)));
  return [...byId.values()];
}

async function loadScopedWeeklyMeetings(profile: AdminProfile): Promise<FirestoreSnapshot[]> {
  const sections = isAdmin(profile)
    ? YOUTH_SECTIONS
    : [...new Set(profile.sections.map((section) => section.trim()).filter(Boolean))];
  if (sections.length === 0) return [];
  const snapshots = await Promise.all(
    sections.map((section) => getDocs(query(collection(db, "weeklyMeetings"), where("section", "==", section))))
  );
  const byId = new Map<string, FirestoreSnapshot>();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((document) => byId.set(document.id, document)));
  return [...byId.values()];
}

async function loadEquipmentAttention(profile: AdminProfile): Promise<LeaderAttentionItem[]> {
  if (!canManageEquipment(profile)) return [];
  const snapshot = await getDocs(collection(db, "equipmentIncidents"));
  return snapshot.docs.flatMap((document) => {
    const data = document.data();
    const status = stringValue(data.status);
    const type = stringValue(data.type);
    const itemName = stringValue(data.itemName);
    const section = stringValue(data.section) || "Group";
    const quantity = typeof data.quantity === "number" && Number.isInteger(data.quantity) ? data.quantity : 0;
    if (status === "resolved" || !["damaged", "lost", "missing", "maintenance"].includes(type) || !itemName || quantity <= 0) return [];
    return [{
      id: `equipment-incident-${document.id}`,
      label: `${incidentTypeLabel(type as "damaged" | "lost" | "missing" | "maintenance")}: ${quantity} × ${itemName}`,
      detail: `${section} · ${stringValue(data.description) || "Equipment issue needs review."}`,
      path: "/leader/equipment",
      severity: "warning" as const
    }];
  }).slice(0, 4);
}

export async function loadAdminOverview(profile: AdminProfile, force = false): Promise<AdminOverview> {
  const key = cacheKey(profile);
  const cached = overviewCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;

  const admin = isAdmin(profile);
  const [pendingParents, pendingLeaders, newJoinApplications, memberDocuments, eventDocuments, meetingDocuments, equipmentAttention] = await Promise.all([
    admin ? countDocuments(query(collection(db, "parentAccounts"), where("status", "==", "pending"))) : Promise.resolve(0),
    admin ? countDocuments(query(collection(db, "leaderRegistrationRequests"), where("status", "==", "pending"))) : Promise.resolve(0),
    countScopedNewJoins(profile),
    loadScopedCollection("members", profile),
    loadScopedCollection("events", profile),
    loadScopedWeeklyMeetings(profile),
    loadEquipmentAttention(profile)
  ]);

  const members: RawMember[] = memberDocuments.flatMap((snapshot) => {
    const data = snapshot.data();
    const section = stringValue(data.section);
    if (!section || !["active", "inactive", "left"].includes(stringValue(data.status))) return [];
    return [{ id: snapshot.id, section, active: data.status === "active" }];
  });

  const activeMembers = members.filter((member) => member.active);
  const sectionCounts = new Map<string, number>();
  activeMembers.forEach((member) => sectionCounts.set(member.section, (sectionCounts.get(member.section) || 0) + 1));
  const membersBySection = [...sectionCounts.entries()].map(([section, count]) => ({ section, count })).sort((a, b) => a.section.localeCompare(b.section));

  const today = todayIso();
  const upcomingEvents = eventDocuments.flatMap((snapshot) => {
    const data = snapshot.data();
    const title = stringValue(data.title);
    const section = stringValue(data.section);
    const startDate = stringValue(data.startDate);
    const status = stringValue(data.status);
    if (!title || !section || !startDate || !EVENT_STATUSES.has(status)) return [];
    const consent = recordValue(data.consent);
    const attendance = recordValue(data.attendance);
    const consentRequired = data.consentRequired === true;
    const eligibleMembers = activeMembers.filter((member) => section === "All Sections" || section === "Group" || member.section === section);
    const outstandingConsent = consentRequired ? eligibleMembers.filter((member) => consent[member.id] !== "received" && attendance[member.id] !== "not-attending").length : 0;
    return [{ id: snapshot.id, title, section, startDate, status, consentRequired, outstandingConsent }];
  }).filter((event) => event.startDate >= today && event.status !== "completed" && event.status !== "closed").sort((a, b) => a.startDate.localeCompare(b.startDate));

  const meetings = meetingDocuments.map(mapMeeting).filter((meeting): meeting is LeaderTodayMeeting => meeting !== null);
  const leaderToday = buildLeaderToday(meetings, upcomingEvents, today);

  const overview: AdminOverview = {
    pendingParents,
    pendingLeaders,
    newJoinApplications,
    activeMembers: activeMembers.length,
    outstandingConsent: upcomingEvents.reduce((total, event) => total + event.outstandingConsent, 0),
    membersBySection,
    upcomingEvents,
    nextMeeting: leaderToday.nextMeeting,
    attentionItems: [...equipmentAttention, ...leaderToday.attentionItems].slice(0, 8)
  };

  overviewCache.set(key, { value: overview, expiresAt: Date.now() + OVERVIEW_CACHE_MS });
  return overview;
}
