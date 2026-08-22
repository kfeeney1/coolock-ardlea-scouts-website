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

export type MemberAttendanceInsight = {
    memberId: string;
    displayName: string;
    section: string;
    completedEvents: number;
    attended: number;
    notAttended: number;
    unrecorded: number;
    attendanceRate: number | null;
    lastRecordedDate: string;
    lastAttendanceStatus: "attending" | "not-attending" | "unrecorded";
};

export function buildMemberAttendanceInsights(
    members: AttendanceInsightMember[],
    events: AttendanceInsightEvent[]
): MemberAttendanceInsight[] {
    const completedEvents = events.filter((event) => event.status === "completed");

    return members
        .filter((member) => member.status === "active")
        .map((member) => {
            const relevant = completedEvents
                .filter((event) => event.section === "All Sections" || event.section === member.section)
                .sort((a, b) => b.startDate.localeCompare(a.startDate));

            let attended = 0;
            let notAttended = 0;
            let unrecorded = 0;

            for (const event of relevant) {
                const status = event.attendance[member.id];
                if (status === "attending") attended += 1;
                else if (status === "not-attending") notAttended += 1;
                else unrecorded += 1;
            }

            const recorded = attended + notAttended;
            const mostRecent = relevant.find((event) => {
                const value = event.attendance[member.id];
                return value === "attending" || value === "not-attending";
            });
            const recentValue = mostRecent?.attendance[member.id];

            return {
                memberId: member.id,
                displayName: member.displayName,
                section: member.section,
                completedEvents: relevant.length,
                attended,
                notAttended,
                unrecorded,
                attendanceRate: recorded > 0 ? Math.round((attended / recorded) * 100) : null,
                lastRecordedDate: mostRecent?.startDate || "",
                lastAttendanceStatus:
                    recentValue === "attending" || recentValue === "not-attending"
                        ? recentValue
                        : "unrecorded"
            };
        })
        .sort((a, b) => {
            const aRate = a.attendanceRate ?? 101;
            const bRate = b.attendanceRate ?? 101;
            if (aRate !== bRate) return aRate - bRate;
            return a.displayName.localeCompare(b.displayName);
        });
}
