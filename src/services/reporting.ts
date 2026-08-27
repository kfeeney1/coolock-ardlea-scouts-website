import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "../firebase";
import type { AttendanceInsightMember } from "./attendanceInsightsLogic";
import { eventReportMembers, type EventReportMember, type EventReportRecord, type MemberReportRow } from "./reportingLogic";

type Scope = {
    isAdmin: boolean;
    sections: string[];
};

const MEMBER_STATUSES = new Set(["active", "inactive", "left"]);
const EVENT_STATUSES = new Set(["draft", "open", "closed", "completed"]);
const memberReportCache = new Map<string, MemberReportRow[]>();

function scopeKey(scope: Scope): string {
    return scope.isAdmin ? "admin" : [...new Set(scope.sections.map((section) => section.trim()).filter(Boolean))].sort().join("|");
}

function stringValue(data: Record<string, unknown>, key: string): string {
    const value = data[key];
    return typeof value === "string" ? value.trim() : "";
}

function stringMap(value: unknown): Record<string, string> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.every(([, entry]) => typeof entry === "string")) return null;
    return Object.fromEntries(entries) as Record<string, string>;
}

async function scopedDocs(collectionName: string, scope: Scope) {
    if (scope.isAdmin) return (await getDocs(collection(db, collectionName))).docs;

    const uniqueSections = [...new Set(scope.sections.map((section) => section.trim()).filter(Boolean))];
    const snapshots = await Promise.all(
        uniqueSections.map((section) =>
            getDocs(query(collection(db, collectionName), where("section", "==", section)))
        )
    );

    const byId = new Map<string, (typeof snapshots)[number]["docs"][number]>();
    for (const snapshot of snapshots) {
        for (const item of snapshot.docs) byId.set(item.id, item);
    }
    return [...byId.values()];
}

function canonicalMember(item: Awaited<ReturnType<typeof scopedDocs>>[number]) {
    const data = item.data() as Record<string, unknown>;
    const displayName = stringValue(data, "displayName");
    const section = stringValue(data, "section");
    const status = stringValue(data, "status");
    if (!displayName || !section || !MEMBER_STATUSES.has(status)) return null;
    return { id: item.id, data, displayName, section, status };
}

export async function loadMemberReportRows(scope: Scope): Promise<MemberReportRow[]> {
    const docs = await scopedDocs("members", scope);
    const rows = docs
        .flatMap((item) => {
            const member = canonicalMember(item);
            if (!member) return [];
            return [{
                id: member.id,
                displayName: member.displayName,
                section: member.section,
                status: member.status,
                parentName: stringValue(member.data, "parentName"),
                emailAddress: stringValue(member.data, "emailAddress"),
                mobileNumber: stringValue(member.data, "mobileNumber")
            }];
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    memberReportCache.set(scopeKey(scope), rows);
    return rows;
}

export async function loadAttendanceInsightMembers(scope: Scope): Promise<AttendanceInsightMember[]> {
    const docs = await scopedDocs("members", scope);
    return docs.flatMap((item) => {
        const member = canonicalMember(item);
        return member ? [{ id: member.id, displayName: member.displayName, section: member.section, status: member.status }] : [];
    });
}

export async function loadEventReportRecords(scope: Scope): Promise<EventReportRecord[]> {
    const docs = await scopedDocs("events", scope);
    return docs
        .flatMap((item) => {
            const data = item.data() as Record<string, unknown>;
            const title = stringValue(data, "title");
            const startDate = stringValue(data, "startDate");
            const section = stringValue(data, "section");
            const status = stringValue(data, "status");
            const attendance = stringMap(data.attendance);
            const consent = stringMap(data.consent);
            if (!title || !startDate || !section || !EVENT_STATUSES.has(status) || attendance === null || consent === null) return [];
            return [{
                id: item.id,
                title,
                startDate,
                section,
                status,
                attendance,
                consent,
                consentRequired: data.consentRequired === true
            }];
        })
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function loadEventReportMembers(event: EventReportRecord, scope: Scope): Promise<EventReportMember[]> {
    const cachedRows = memberReportCache.get(scopeKey(scope));
    if (cachedRows) return eventReportMembers(event, cachedRows);

    const docs = await scopedDocs("members", scope);
    const rows: MemberReportRow[] = docs.flatMap((item) => {
        const member = canonicalMember(item);
        if (!member) return [];
        return [{
            id: member.id,
            displayName: member.displayName,
            section: member.section,
            status: member.status,
            parentName: "",
            emailAddress: "",
            mobileNumber: ""
        }];
    });
    return eventReportMembers(event, rows);
}
