import { collection, getDocs, query, where, type QueryDocumentSnapshot } from "firebase/firestore";
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

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

async function loadScopedCollection(collectionName: string, profile: AdminProfile): Promise<FirestoreSnapshot[]> {
  if (isAdmin(profile)) {
    return (await getDocs(collection(db, collectionName))).docs;
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

export async function loadAdminOverview(profile: AdminProfile): Promise<AdminOverview> {
  const admin = isAdmin(profile);
  const [parentSnapshot, leaderSnapshot, joinDocuments, memberDocuments, eventDocuments] = await Promise.all([
    admin ? getDocs(collection(db, "parentAccounts")) : Promise.resolve(null),
    admin ? getDocs(collection(db, "leaderRegistrationRequests")) : Promise.resolve(null),
    loadScopedCollection("joinApplications", profile),
    loadScopedCollection("members", profile),
    loadScopedCollection("events", profile)
  ]);

  const pendingParents = parentSnapshot?.docs.filter(
    (snapshot) => snapshot.data().status === "pending"
  ).length ?? 0;

  const pendingLeaders = leaderSnapshot?.docs.filter(
    (snapshot) => snapshot.data().status === "pending"
  ).length ?? 0;

  const newJoinApplications = joinDocuments.filter(
    (snapshot) => snapshot.data().status === "new"
  ).length;

  const members: RawMember[] = memberDocuments.map((snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      section: stringValue(data.section) || "Other",
      active: data.status !== "inactive" && data.status !== "left"
    };
  });

  const activeMembers = members.filter((member) => member.active);
  const sectionCounts = new Map<string, number>();
  activeMembers.forEach((member) => {
    sectionCounts.set(member.section, (sectionCounts.get(member.section) || 0) + 1);
  });

  const membersBySection = [...sectionCounts.entries()]
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => a.section.localeCompare(b.section));

  const today = todayIso();
  const upcomingEvents = eventDocuments
    .map((snapshot) => {
      const data = snapshot.data();
      const section = stringValue(data.section) || "All Sections";
      const consent = recordValue(data.consent);
      const attendance = recordValue(data.attendance);
      const consentRequired = data.consentRequired === true;
      const eligibleMembers = activeMembers.filter(
        (member) => section === "All Sections" || section === "Group" || member.section === section
      );
      const outstandingConsent = consentRequired
        ? eligibleMembers.filter(
            (member) => consent[member.id] !== "received" && attendance[member.id] !== "not-attending"
          ).length
        : 0;

      return {
        id: snapshot.id,
        title: stringValue(data.title) || "Untitled event",
        section,
        startDate: stringValue(data.startDate),
        status: stringValue(data.status) || "draft",
        consentRequired,
        outstandingConsent
      };
    })
    .filter(
      (event) =>
        event.startDate >= today &&
        event.status !== "completed" &&
        event.status !== "closed"
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return {
    pendingParents,
    pendingLeaders,
    newJoinApplications,
    activeMembers: activeMembers.length,
    outstandingConsent: upcomingEvents.reduce(
      (total, event) => total + event.outstandingConsent,
      0
    ),
    membersBySection,
    upcomingEvents
  };
}
