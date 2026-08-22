import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

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
  activeMembers: number;
  outstandingConsent: number;
  membersBySection: Array<{ section: string; count: number }>;
  upcomingEvents: AdminOverviewEvent[];
};

type RawMember = { id: string; section: string; active: boolean };

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

export async function loadAdminOverview(): Promise<AdminOverview> {
  const [parentSnapshot, leaderSnapshot, memberSnapshot, eventSnapshot] = await Promise.all([
    getDocs(collection(db, "parentAccounts")),
    getDocs(collection(db, "leaderRegistrationRequests")),
    getDocs(collection(db, "members")),
    getDocs(collection(db, "events"))
  ]);

  const pendingParents = parentSnapshot.docs.filter(
    (snapshot) => snapshot.data().status === "pending"
  ).length;

  const pendingLeaders = leaderSnapshot.docs.filter(
    (snapshot) => snapshot.data().status === "pending"
  ).length;

  const members: RawMember[] = memberSnapshot.docs.map((snapshot) => {
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
  const upcomingEvents = eventSnapshot.docs
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
    activeMembers: activeMembers.length,
    outstandingConsent: upcomingEvents.reduce(
      (total, event) => total + event.outstandingConsent,
      0
    ),
    membersBySection,
    upcomingEvents
  };
}
