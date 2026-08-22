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

export function slug(value: string): string {
    return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "report";
}
