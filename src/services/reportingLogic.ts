export type MemberReportRow = {
    displayName: string;
    section: string;
    status: string;
    parentName: string;
    emailAddress: string;
    mobileNumber: string;
};

export type EventReportMember = {
    id: string;
    displayName: string;
    section: string;
};

export type EventReportRecord = {
    id: string;
    title: string;
    startDate: string;
    section: string;
    status: string;
    attendance: Record<string, string>;
    consent: Record<string, string>;
    consentRequired: boolean;
};

function safeSpreadsheetValue(value: string): string {
    const trimmedStart = value.trimStart();
    if (/^[=+\-@]/.test(trimmedStart)) return `'${value}`;
    return value;
}

export function csvCell(value: unknown): string {
    const text = safeSpreadsheetValue(String(value ?? ""));
    return `"${text.replaceAll('"', '""')}"`;
}

export function filterEventsByDateRange(events: EventReportRecord[], fromDate = "", toDate = ""): EventReportRecord[] {
    return events.filter((event) => {
        if (!event.startDate) return !fromDate && !toDate;
        if (fromDate && event.startDate < fromDate) return false;
        if (toDate && event.startDate > toDate) return false;
        return true;
    });
}

export function memberReportCsv(rows: MemberReportRow[]): string {
    const header = ["Member", "Section", "Status", "Parent / Guardian", "Email", "Mobile"];
    const body = rows.map((row) => [
        row.displayName,
        row.section,
        row.status,
        row.parentName,
        row.emailAddress,
        row.mobileNumber
    ].map(csvCell).join(","));

    return [header.map(csvCell).join(","), ...body].join("\r\n");
}

export function membershipSummaryCsv(rows: MemberReportRow[]): string {
    const sections = [...new Set(rows.map((row) => row.section))].sort((a, b) => a.localeCompare(b));
    const header = ["Section", "Active", "Inactive", "Left", "Total"];
    const body = sections.map((section) => {
        const scoped = rows.filter((row) => row.section === section);
        return [
            section,
            scoped.filter((row) => row.status === "active").length,
            scoped.filter((row) => row.status === "inactive").length,
            scoped.filter((row) => row.status === "left").length,
            scoped.length
        ].map(csvCell).join(",");
    });
    const total = [
        "All permitted sections",
        rows.filter((row) => row.status === "active").length,
        rows.filter((row) => row.status === "inactive").length,
        rows.filter((row) => row.status === "left").length,
        rows.length
    ].map(csvCell).join(",");
    return [header.map(csvCell).join(","), ...body, total].join("\r\n");
}

function attendanceLabel(value: string): string {
    if (value === "attending") return "Attending";
    if (value === "not-attending") return "Not attending";
    return "Invited";
}

function consentLabel(value: string, required: boolean): string {
    if (value === "received") return "Received";
    if (value === "required" || required) return "Outstanding";
    return "Not required";
}

export function eventRosterCsv(event: EventReportRecord, members: EventReportMember[]): string {
    const header = ["Event", "Date", "Member", "Section", "Attendance", "Consent"];
    const body = members.map((member) => [
        event.title,
        event.startDate,
        member.displayName,
        member.section,
        attendanceLabel(event.attendance[member.id] || "invited"),
        consentLabel(event.consent[member.id] || "", event.consentRequired)
    ].map(csvCell).join(","));

    return [header.map(csvCell).join(","), ...body].join("\r\n");
}

export function eventOverviewCsv(events: EventReportRecord[]): string {
    const header = ["Event", "Date", "Section", "Status", "Consent required", "Attending", "Not attending", "Consent received"];
    const body = events.map((event) => [
        event.title,
        event.startDate,
        event.section,
        event.status,
        event.consentRequired ? "Yes" : "No",
        Object.values(event.attendance).filter((value) => value === "attending").length,
        Object.values(event.attendance).filter((value) => value === "not-attending").length,
        Object.values(event.consent).filter((value) => value === "received").length
    ].map(csvCell).join(","));
    return [header.map(csvCell).join(","), ...body].join("\r\n");
}

export function attendanceTrendCsv(events: EventReportRecord[]): string {
    const header = ["Event", "Date", "Section", "Recorded responses", "Attending", "Not attending", "Attendance rate"];
    const body = events.map((event) => {
        const values = Object.values(event.attendance);
        const attending = values.filter((value) => value === "attending").length;
        const notAttending = values.filter((value) => value === "not-attending").length;
        const recorded = attending + notAttending;
        const rate = recorded === 0 ? "" : `${Math.round((attending / recorded) * 100)}%`;
        return [event.title, event.startDate, event.section, recorded, attending, notAttending, rate].map(csvCell).join(",");
    });
    return [header.map(csvCell).join(","), ...body].join("\r\n");
}

export function outstandingConsentCsv(event: EventReportRecord, members: EventReportMember[]): string {
    const header = ["Event", "Date", "Member", "Section", "Attendance", "Consent"];
    const body = members
        .filter((member) => event.consentRequired && event.consent[member.id] !== "received")
        .map((member) => [
            event.title,
            event.startDate,
            member.displayName,
            member.section,
            attendanceLabel(event.attendance[member.id] || "invited"),
            "Outstanding"
        ].map(csvCell).join(","));
    return [header.map(csvCell).join(","), ...body].join("\r\n");
}

export function slug(value: string): string {
    return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "report";
}
