import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "../firebase";
import type { EventReportMember, EventReportRecord, MemberReportRow } from "./reportingLogic";

type Scope = {
    isAdmin: boolean;
    sections: string[];
};

function stringValue(data: Record<string, unknown>, key: string): string {
    const value = data[key];
    return typeof value === "string" ? value.trim() : "";
}

function stringMap(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (typeof entry === "string") result[key] = entry;
    }
    return result;
}

async function scopedDocs(collectionName: string, scope: Scope) {
    if (scope.isAdmin) return (await getDocs(collection(db, collectionName))).docs;

    const uniqueSections = [...new Set(scope.sections.filter(Boolean))];
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

export async function loadMemberReportRows(scope: Scope): Promise<MemberReportRow[]> {
    const docs = await scopedDocs("members", scope);
    return docs
        .map((item) => {
            const data = item.data() as Record<string, unknown>;
            return {
                displayName: stringValue(data, "displayName") || "Unnamed member",
                section: stringValue(data, "section"),
                status: stringValue(data, "status") || "active",
                parentName: stringValue(data, "parentName"),
                emailAddress: stringValue(data, "emailAddress"),
                mobileNumber: stringValue(data, "mobileNumber")
            };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function loadEventReportRecords(scope: Scope): Promise<EventReportRecord[]> {
    const docs = await scopedDocs("events", scope);
    return docs
        .map((item) => {
            const data = item.data() as Record<string, unknown>;
            return {
                id: item.id,
                title: stringValue(data, "title") || "Untitled event",
                startDate: stringValue(data, "startDate"),
                section: stringValue(data, "section"),
                attendance: stringMap(data.attendance),
                consent: stringMap(data.consent),
                consentRequired: data.consentRequired === true
            };
        })
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function loadEventReportMembers(event: EventReportRecord, scope: Scope): Promise<EventReportMember[]> {
    const docs = await scopedDocs("members", scope);
    return docs
        .map((item) => {
            const data = item.data() as Record<string, unknown>;
            return {
                id: item.id,
                displayName: stringValue(data, "displayName") || "Unnamed member",
                section: stringValue(data, "section"),
                status: stringValue(data, "status") || "active"
            };
        })
        .filter((member) => member.status === "active")
        .filter((member) => event.section === "All Sections" || member.section === event.section)
        .map(({ id, displayName, section }) => ({ id, displayName, section }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
