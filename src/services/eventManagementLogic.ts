import type { MemberRecord } from "./memberAdmin";
import type { AttendanceStatus, EventConsentStatus, EventInput, EventRecord, EventStatus } from "./eventAdmin";

export const EVENT_SECTIONS = ["All Sections", "Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Other"];
export const EVENT_TYPES = ["Weekly Meeting", "Activity", "Day Trip", "Camp", "Hike", "Fundraiser", "Other"];
export const EVENT_STATUSES: EventStatus[] = ["draft", "open", "closed", "completed"];

export const EMPTY_EVENT: EventInput = {
    title: "",
    description: "",
    eventType: "Activity",
    section: "All Sections",
    location: "",
    meetingPoint: "",
    returnDetails: "",
    leaderNotes: "",
    startDate: "",
    endDate: "",
    status: "draft",
    consentRequired: false
};

export function eventStatusLabel(status: EventStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

export function attendanceLabel(status: AttendanceStatus): string {
    if (status === "attending") return "Attending";
    if (status === "not-attending") return "Not attending";
    return "Invited";
}

export function consentLabel(status: EventConsentStatus): string {
    if (status === "received") return "Received";
    if (status === "required") return "Outstanding";
    return "Not required";
}

export function normaliseEventTitle(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IE");
}

export function isDuplicateEventIdentity(
    draft: Pick<EventInput, "title" | "startDate" | "section">,
    events: EventRecord[],
    excludeEventId?: string
): boolean {
    const titleKey = normaliseEventTitle(draft.title);
    if (!titleKey || !draft.startDate || !draft.section) return false;
    return events.some((event) => event.id !== excludeEventId
        && normaliseEventTitle(event.title) === titleKey
        && event.startDate === draft.startDate
        && event.section === draft.section);
}

export function eventInput(record: EventRecord): EventInput {
    return {
        title: record.title,
        description: record.description,
        eventType: record.eventType,
        section: record.section,
        location: record.location,
        meetingPoint: record.meetingPoint,
        returnDetails: record.returnDetails,
        leaderNotes: record.leaderNotes,
        startDate: record.startDate,
        endDate: record.endDate,
        status: record.status,
        consentRequired: record.consentRequired
    };
}

export function eventMembers(event: EventRecord, members: MemberRecord[]): MemberRecord[] {
    return members.filter((member) => member.status === "active" && (event.section === "All Sections" || member.section === event.section));
}

export function eventCounts(event: EventRecord, members: MemberRecord[]) {
    const relevantMembers = eventMembers(event, members);
    let attending = 0;
    let notAttending = 0;
    let invited = 0;
    let consentReceived = 0;
    let consentOutstanding = 0;
    relevantMembers.forEach((member) => {
        const attendance = event.attendance[member.id] || "invited";
        const consent = event.consent[member.id] || (event.consentRequired ? "required" : "not-required");
        if (attendance === "attending") attending += 1;
        else if (attendance === "not-attending") notAttending += 1;
        else invited += 1;
        if (consent === "received") consentReceived += 1;
        if (consent === "required") consentOutstanding += 1;
    });
    return { members: relevantMembers.length, attending, notAttending, invited, consentReceived, consentOutstanding };
}

export function filterEvents(events: EventRecord[], search: string, sectionFilter: string, statusFilter: EventStatus | "all") {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
        if (sectionFilter !== "All Sections" && event.section !== "All Sections" && event.section !== sectionFilter) return false;
        if (statusFilter !== "all" && event.status !== statusFilter) return false;
        if (!query) return true;
        return [event.title, event.description, event.location, event.meetingPoint, event.section, event.eventType].join(" ").toLowerCase().includes(query);
    });
}

function csvCell(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function eventRosterCsv(event: EventRecord, members: MemberRecord[]): string {
    const summary = eventCounts(event, members);
    const rows = eventMembers(event, members).map((member) => {
        const attendanceStatus = event.attendance[member.id] || "invited";
        const consentStatus = event.consent[member.id] || (event.consentRequired ? "required" : "not-required");
        return [event.title, event.startDate, event.status, member.displayName, member.section, attendanceLabel(attendanceStatus), consentLabel(consentStatus), member.parentName || "", member.mobileNumber || "", member.emergencyContactName || "", member.emergencyContactPhone || ""].map((value) => csvCell(String(value))).join(",");
    });
    return [
        `Event summary,${csvCell(`${summary.attending} attending; ${summary.notAttending} not attending; ${summary.invited} invited; ${summary.consentReceived} consent received; ${summary.consentOutstanding} consent outstanding`)}`,
        "",
        ["Event", "Date", "Event Status", "Member", "Section", "Attendance", "Consent", "Parent / Guardian", "Phone", "Emergency Contact", "Emergency Phone"].map(csvCell).join(","),
        ...rows
    ].join("\r\n");
}

export function eventRosterPrintHtml(event: EventRecord, members: MemberRecord[]): string {
    const summary = eventCounts(event, members);
    const rows = eventMembers(event, members).map((member) => {
        const attendanceStatus = event.attendance[member.id] || "invited";
        const consentStatus = event.consent[member.id] || (event.consentRequired ? "required" : "not-required");
        return `<tr><td>${escapeHtml(member.displayName)}</td><td>${escapeHtml(member.section)}</td><td>${escapeHtml(attendanceLabel(attendanceStatus))}</td><td>${escapeHtml(consentLabel(consentStatus))}</td><td>${escapeHtml(member.parentName || "")}</td><td>${escapeHtml(member.mobileNumber || "")}</td><td>${escapeHtml(member.emergencyContactName || "")}</td><td>${escapeHtml(member.emergencyContactPhone || "")}</td></tr>`;
    }).join("");
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(event.title)} - Event Report</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#1f2937}h1{color:#081E67;margin-bottom:6px}.meta{margin-bottom:14px;color:#4b5563}.summary{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.summary span{border:1px solid #d1d5db;border-radius:6px;padding:7px 10px}.notes{padding:12px;border:1px solid #ddd;margin:14px 0;white-space:pre-wrap}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d1d5db;padding:7px;text-align:left}th{background:#EEF1FA;color:#081E67}.controls{margin-bottom:20px}@media print{.controls{display:none}}</style></head><body><div class="controls"><button onclick="window.print()">Print / Save PDF</button></div><h1>${escapeHtml(event.title)}</h1><div class="meta">${escapeHtml(event.eventType)} · ${escapeHtml(event.section)} · ${escapeHtml(event.startDate)}${event.endDate ? ` to ${escapeHtml(event.endDate)}` : ""}${event.location ? ` · ${escapeHtml(event.location)}` : ""} · ${escapeHtml(eventStatusLabel(event.status))}</div><div class="summary"><span><strong>${summary.members}</strong> members</span><span><strong>${summary.attending}</strong> attending</span><span><strong>${summary.notAttending}</strong> not attending</span><span><strong>${summary.invited}</strong> invited</span><span><strong>${summary.consentReceived}</strong> consent received</span><span><strong>${summary.consentOutstanding}</strong> consent outstanding</span></div>${event.meetingPoint ? `<div><strong>Meeting point:</strong> ${escapeHtml(event.meetingPoint)}</div>` : ""}${event.returnDetails ? `<div><strong>Return details:</strong> ${escapeHtml(event.returnDetails)}</div>` : ""}${event.leaderNotes ? `<div class="notes"><strong>Leader notes</strong><br/>${escapeHtml(event.leaderNotes)}</div>` : ""}<table><thead><tr><th>Member</th><th>Section</th><th>Attendance</th><th>Consent</th><th>Parent / Guardian</th><th>Phone</th><th>Emergency Contact</th><th>Emergency Phone</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function eventRosterFilename(title: string): string {
    return `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event"}-roster.csv`;
}
