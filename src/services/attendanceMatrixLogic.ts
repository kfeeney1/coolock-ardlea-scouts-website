import type { AttendanceDateRange, AttendanceInsightMember, AttendanceInsightMeeting } from "./attendanceInsightsLogic.ts";
import { compareMembersBySurname } from "./memberManagementLogic.ts";

export type AttendanceMatrixState = "present" | "absent" | "not-applicable" | "unrecorded";
export type AttendanceMatrix = {
  meetings: Array<{ id: string; date: string; title: string; section: string }>;
  rows: Array<{ memberId: string; displayName: string; states: AttendanceMatrixState[] }>;
};

/** Pure projection of already-authorised records. Firestore Rules remain the read boundary.
 * Missing entries never establish absence. Section membership establishes applicability only.
 * Build one entry index per meeting rather than scanning entries for every cell.
 */
export function buildAttendanceMatrix(
  members: AttendanceInsightMember[], meetings: AttendanceInsightMeeting[],
  options: AttendanceDateRange & { section?: string; search?: string } = {}
): AttendanceMatrix {
  const selected = options.section && options.section !== "all" ? options.section : "";
  const search = options.search?.trim().toLocaleLowerCase() || "";
  const sectionsFor = (member: AttendanceInsightMember) => new Set([member.section, ...member.sections]);
  const roster = members.filter(member => member.status === "active"
    && (!selected || sectionsFor(member).has(selected))
    && (!search || member.displayName.toLocaleLowerCase().includes(search)))
    .map(member => ({ ...member, firstName: member.firstName || "", lastName: member.lastName || "" }))
    .sort(compareMembersBySurname);
  const memberSections = new Set(roster.flatMap(member => [...sectionsFor(member)]));
  const history = meetings.filter(meeting => meeting.status === "closed"
    && (!selected || meeting.section === selected) && memberSections.has(meeting.section)
    && (!options.from || meeting.meetingDate >= options.from)
    && (!options.to || meeting.meetingDate <= options.to))
    .slice().sort((a, b) => a.meetingDate.localeCompare(b.meetingDate) || a.id.localeCompare(b.id));
  const indexes = history.map(meeting => new Map(meeting.entries.map(entry => [entry.memberId, entry.attendance])));
  return {
    meetings: history.map(meeting => ({ id: meeting.id, date: meeting.meetingDate, title: meeting.theme?.trim() || "Weekly Meeting", section: meeting.section })),
    rows: roster.map(member => ({ memberId: member.id, displayName: member.displayName,
      states: history.map((meeting, index) => {
        if (!sectionsFor(member).has(meeting.section)) return "not-applicable";
        const attendance = indexes[index].get(member.id);
        return attendance === "present" || attendance === "absent" ? attendance : "unrecorded";
      })
    }))
  };
}
