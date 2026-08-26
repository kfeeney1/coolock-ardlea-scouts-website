export type AttendanceInsightMember = {
    id: string;
    displayName: string;
    section: string;
    status: string;
};

export type AttendanceInsightEvent = {
    id: string;
    title: string;
    startDate: string;
    section: string;
    status: string;
    attendance: Record<string, string>;
};

export type AttendanceInsightMeeting = {
    id: string;
    section: string;
    meetingDate: string;
    status: string;
    entries: Array<{ memberId: string; attendance: string }>;
};

export type AttendanceHistoryRow = {
    id: string;
    title: string;
    date: string;
    source: "meeting" | "event";
    status: "present" | "absent" | "unrecorded" | "attending" | "not-attending";
};

export type MemberAttendanceHistory = {
    meetings: AttendanceHistoryRow[];
    events: AttendanceHistoryRow[];
};

export type AttendanceRateSummary = {
    attended: number;
    notAttended: number;
    unrecorded: number;
    recorded: number;
    rate: number | null;
};

export type MemberAttendanceInsight = {
    memberId: string;
    displayName: string;
    section: string;
    meeting: AttendanceRateSummary;
    event: AttendanceRateSummary;
    combined: AttendanceRateSummary;
    lastRecordedDate: string;
    lastRecordedSource: "meeting" | "event" | null;
    lastAttendanceStatus: "attended" | "not-attended" | "unrecorded";
};

export type AttendanceDateRange = {
    from?: string;
    to?: string;
};

function inDateRange(date: string, range: AttendanceDateRange): boolean {
    if (range.from && date < range.from) return false;
    if (range.to && date > range.to) return false;
    return true;
}

function summarise(rows: AttendanceHistoryRow[]): AttendanceRateSummary {
    let attended = 0;
    let notAttended = 0;
    let unrecorded = 0;

    for (const row of rows) {
        if (row.status === "present" || row.status === "attending") attended += 1;
        else if (row.status === "absent" || row.status === "not-attending") notAttended += 1;
        else unrecorded += 1;
    }

    const recorded = attended + notAttended;
    return {
        attended,
        notAttended,
        unrecorded,
        recorded,
        rate: recorded > 0 ? Math.round((attended / recorded) * 100) : null
    };
}

export function buildMemberAttendanceHistory(
    member: AttendanceInsightMember,
    events: AttendanceInsightEvent[],
    meetings: AttendanceInsightMeeting[],
    range: AttendanceDateRange = {}
): MemberAttendanceHistory {
    const eventRows = events
        .filter((event) => event.status === "completed")
        .filter((event) => event.section === "All Sections" || event.section === member.section)
        .filter((event) => inDateRange(event.startDate, range))
        .map<AttendanceHistoryRow>((event) => {
            const raw = event.attendance[member.id];
            return {
                id: event.id,
                title: event.title,
                date: event.startDate,
                source: "event",
                status: raw === "attending" || raw === "not-attending" ? raw : "unrecorded"
            };
        })
        .sort((a, b) => b.date.localeCompare(a.date));

    const meetingRows = meetings
        .filter((meeting) => meeting.status === "closed" && meeting.section === member.section)
        .filter((meeting) => inDateRange(meeting.meetingDate, range))
        .map<AttendanceHistoryRow>((meeting) => {
            const entry = meeting.entries.find((candidate) => candidate.memberId === member.id);
            const status = entry?.attendance === "present" || entry?.attendance === "absent" ? entry.attendance : "unrecorded";
            return { id: meeting.id, title: "Weekly Meeting", date: meeting.meetingDate, source: "meeting", status };
        })
        .sort((a, b) => b.date.localeCompare(a.date));

    return { meetings: meetingRows, events: eventRows };
}

export function buildMemberAttendanceInsights(
    members: AttendanceInsightMember[],
    events: AttendanceInsightEvent[],
    meetings: AttendanceInsightMeeting[],
    range: AttendanceDateRange = {}
): MemberAttendanceInsight[] {
    return members
        .filter((member) => member.status === "active")
        .map<MemberAttendanceInsight>((member) => {
            const history = buildMemberAttendanceHistory(member, events, meetings, range);
            const meeting = summarise(history.meetings);
            const event = summarise(history.events);
            const combinedRows = [...history.meetings, ...history.events].sort((a, b) => b.date.localeCompare(a.date));
            const combined = summarise(combinedRows);
            const mostRecent = combinedRows.find((row) => row.status !== "unrecorded");
            const lastAttendanceStatus: MemberAttendanceInsight["lastAttendanceStatus"] = !mostRecent
                ? "unrecorded"
                : mostRecent.status === "present" || mostRecent.status === "attending"
                  ? "attended"
                  : "not-attended";

            return {
                memberId: member.id,
                displayName: member.displayName,
                section: member.section,
                meeting,
                event,
                combined,
                lastRecordedDate: mostRecent?.date || "",
                lastRecordedSource: mostRecent?.source || null,
                lastAttendanceStatus
            };
        })
        .sort((a, b) => {
            const aRate = a.combined.rate ?? 101;
            const bRate = b.combined.rate ?? 101;
            if (aRate !== bRate) return aRate - bRate;
            return a.displayName.localeCompare(b.displayName);
        });
}
