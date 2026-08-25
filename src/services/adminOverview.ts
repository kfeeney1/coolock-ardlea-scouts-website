import { collection, getCountFromServer, getDocs, query, where, type Query, type QueryConstraint, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { AdminProfile } from "../components/admin/AdminAuthProvider";

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
};

type RawMember = { id: string; section: string; active: boolean };
type FirestoreSnapshot = QueryDocumentSnapshot;
type CacheEntry = { expiresAt: number; value: AdminOverview };

const OVERVIEW_CACHE_MS = 90_000;
const overviewCache = new Map<string, CacheEntry>();
const EVENT_STATUSES = new Set(["draft", "open", "closed", "completed"]);

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
  return `${profile.role}:${[...new Set(profile.sections)].sort().join("|")}`;
}

async function countDocuments(target: Query): Promise<number> {
  const snapshot = await getCountFromServer(target);
  return snapshot.data().count;
}

async function countScopedNewJoins(profile: AdminProfile): Promise<number> {
  if (isAdmin(profile)) {
    return countDocuments(query(collection(db, "joinApplications"), where("status", "==", "new")));
  }

  const sections = [...new Set(profile.sections.map((section) => section.trim()).filter(Boolean))];
  if (sections.length === 0) return 0;

  const counts = await Promise.all(
    sections.map((section) => countDocuments(query(collection(db, "joinApplications"), where("section", "==", section), where("status", "==", "new"))))
  );
  return counts.reduce((total, count) => total + count, 0);
}

async function loadScopedCollection(
  collectionName: string,
  profile: AdminProfile,
  adminConstraints: QueryConstraint[] = []
): Promise<FirestoreSnapshot[]> {
  if (isAdmin(profile)) {
    const target = adminConstraints.length > 0
      ? query(collection(db, collectionName), ...adminConstraints)
      : collection(db, collectionName);
    return (await getDocs(target)).docs;
  }

  const sections = [...new Set(profile.sections.map((section) => section.trim()).filter(Boolean))];
  if (sections.length === 0) return [];

  const snapshots = await Promise.all(
    sections.map((section) => getDocs(query(collection(db, collectionName), where("section", "==", section))))
  );

  const byId = new Map<string, FirestoreSnapshot>();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((document) => byId.set(document.id, document)));
  return [...byId.values()];
}

export async function loadAdminOverview(profile: AdminProfile, force = false): Promise<AdminOverview> {
  const key = cacheKey(profile);
  const cached = overviewCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;

  const admin = isAdmin(profile);
  const today = todayIso();
  const [pendingParents, pendingLeaders, newJoinApplications, memberDocuments, eventDocuments] = await Promise.all([
    admin ? countDocuments(query(collection(db, "parentAccounts"), where("status", "==", "pending"))) : Promise.resolve(0),
    admin ? countDocuments(query(collection(db, "leaderRegistrationRequests"), where("status", "==", "pending"))) : Promise.resolve(0),
    countScopedNewJoins(profile),
    loadScopedCollection("members", profile, [where("status", "==", "active")]),
    loadScopedCollection("events", profile, [where("startDate", ">=", today)])
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

  const membersBySection = [...sectionCounts.entries()]
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => a.section.localeCompare(b.section));

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
      const eligibleMembers = activeMembers.filter(
        (member) => section === "All Sections" || section === "Group" || member.section === section
      );
      const outstandingConsent = consentRequired
        ? eligibleMembers.filter((member) => consent[member.id] !== "received" && attendance[member.id] !== "not-attending").length
        : 0;

      return [{ id: snapshot.id, title, section, startDate, status, consentRequired, outstandingConsent }];
    })
    .filter((event) => event.startDate >= today && event.status !== "completed" && event.status !== "closed")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const overview: AdminOverview = {
    pendingParents,
    pendingLeaders,
    newJoinApplications,
    activeMembers: activeMembers.length,
    outstandingConsent: upcomingEvents.reduce((total, event) => total + event.outstandingConsent, 0),
    membersBySection,
    upcomingEvents
  };

  overviewCache.set(key, { value: overview, expiresAt: Date.now() + OVERVIEW_CACHE_MS });
  return overview;
}
