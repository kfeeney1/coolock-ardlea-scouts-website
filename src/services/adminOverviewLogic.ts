import type { AdminProfile } from "../components/admin/AdminAuthProvider";
import { isGroupLeadershipAppointment } from "../security/scoutingAppointments.ts";
import { YOUTH_SECTION_NAMES } from "./leaderAccessLogic";

type JoinOverviewProfile = Pick<AdminProfile, "role" | "scoutingRole" | "sections" | "appointments">;

/** Mirrors the section-level joinApplications read grants in firestore.rules. */
export function joinApplicationOverviewSections(profile: JoinOverviewProfile): string[] {
  if (profile.role === "admin" || profile.role === "super-admin") return [...YOUTH_SECTION_NAMES];
  if (isGroupLeadershipAppointment(profile.scoutingRole)) return [...YOUTH_SECTION_NAMES];

  const appointedSections = new Set(profile.appointments
    .filter((appointment) => appointment.active !== false && appointment.appointment === "Section Leader")
    .map((appointment) => appointment.scope));
  return profile.sections.filter((section) => section !== "Group" && appointedSections.has(section));
}

export type LeaderTodayMeeting = {
  id: string;
  section: string;
  meetingDate: string;
  status: string;
  location: string;
  programmeReady: boolean;
  attendanceStarted: boolean;
};

export type LeaderTodayEvent = {
  id: string;
  title: string;
  startDate: string;
  outstandingConsent: number;
};

export type LeaderAttentionItem = {
  id: string;
  label: string;
  detail: string;
  path: string;
  severity: "warning" | "info";
};

export function buildLeaderToday(
  meetings: LeaderTodayMeeting[],
  events: LeaderTodayEvent[],
  today: string
): { nextMeeting: LeaderTodayMeeting | null; attentionItems: LeaderAttentionItem[] } {
  const openMeetings = meetings.filter((meeting) => meeting.status === "open");
  const nextMeeting = [...openMeetings]
    .filter((meeting) => meeting.meetingDate >= today)
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))[0] ?? null;

  const attentionItems: LeaderAttentionItem[] = [];

  [...openMeetings]
    .filter((meeting) => meeting.meetingDate < today)
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))
    .slice(0, 2)
    .forEach((meeting) => attentionItems.push({
      id: `meeting-open-${meeting.id}`,
      label: `${meeting.section} meeting from ${meeting.meetingDate} is still open`,
      detail: "Close the meeting when attendance and notes are complete.",
      path: "/leader/weekly",
      severity: "warning"
    }));

  if (nextMeeting && !nextMeeting.programmeReady) {
    attentionItems.push({
      id: `meeting-programme-${nextMeeting.id}`,
      label: `${nextMeeting.section} meeting on ${nextMeeting.meetingDate} has no programme`,
      detail: "Add an activity, badgework, theme or programme note before the meeting.",
      path: "/leader/weekly",
      severity: "warning"
    });
  }

  if (nextMeeting?.meetingDate === today && !nextMeeting.attendanceStarted) {
    attentionItems.push({
      id: `meeting-attendance-${nextMeeting.id}`,
      label: `${nextMeeting.section} attendance has not started`,
      detail: "Open Weekly Meetings to record attendance for today.",
      path: "/leader/weekly",
      severity: "info"
    });
  }

  events
    .filter((event) => event.outstandingConsent > 0)
    .slice(0, 3)
    .forEach((event) => attentionItems.push({
      id: `event-consent-${event.id}`,
      label: `${event.outstandingConsent} consent outstanding for ${event.title}`,
      detail: `Event date: ${event.startDate}`,
      path: "/leader/event-consent",
      severity: "warning"
    }));

  return { nextMeeting, attentionItems: attentionItems.slice(0, 6) };
}
