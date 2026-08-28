import { daysUntilExpiry, isConsentExpired } from "./consentAdmin.ts";
import type { ConsentAdminRecord } from "./consentAdmin.ts";

export type TypeFilter = "all" | "youth" | "scouter";
export type AlertFilter = "all" | "medical" | "medication" | "expiring" | "expired";
export type SummaryFilter = "total" | "youth" | "scouter" | "medication" | "medical" | "expired";

export const CONSENT_SECTIONS = ["all", "Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Scouter"];

export function formatDate(date: Date | null): string {
    if (!date) return "Unknown";
    return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDateOnly(value: string): string {
    if (!value) return "Not provided";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(date);
}

export function formatFieldName(key: string): string {
    return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function displayValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(", ");
    if (typeof value === "object") {
        if ("seconds" in value || "nanoseconds" in value) return "";
        return JSON.stringify(value, null, 2);
    }
    return String(value);
}

export function objectField(data: Record<string, unknown>, key: string): string {
    return displayValue(data[key]);
}

export function expiryLabel(record: ConsentAdminRecord): string {
    if (!record.consentTo) return "No expiry date";
    const days = daysUntilExpiry(record.consentTo);
    if (days === null) return record.consentTo;
    if (days < 0) return `Expired ${Math.abs(days)} day(s) ago`;
    if (days === 0) return "Expires today";
    return `Expires in ${days} day(s)`;
}

export function filterConsentRecords(records: ConsentAdminRecord[], search: string, typeFilter: TypeFilter, sectionFilter: string, alertFilter: AlertFilter): ConsentAdminRecord[] {
    const queryText = search.trim().toLowerCase();
    return records.filter((record) => {
        if (typeFilter !== "all" && record.type !== typeFilter) return false;
        if (sectionFilter !== "all" && record.section !== sectionFilter) return false;
        const days = daysUntilExpiry(record.consentTo);
        if (alertFilter === "medical" && !record.hasMedicalAlert) return false;
        if (alertFilter === "medication" && !record.hasMedicationManagement) return false;
        if (alertFilter === "expired" && !isConsentExpired(record.consentTo)) return false;
        if (alertFilter === "expiring" && !(days !== null && days >= 0 && days <= 30)) return false;
        if (!queryText) return true;
        return [record.memberName, record.section, record.status, JSON.stringify(record.data)].join(" ").toLowerCase().includes(queryText);
    });
}

export function consentTotals(records: ConsentAdminRecord[]) {
    return {
        total: records.length,
        youth: records.filter((record) => record.type === "youth").length,
        scouter: records.filter((record) => record.type === "scouter").length,
        medication: records.filter((record) => record.hasMedicationManagement).length,
        medical: records.filter((record) => record.hasMedicalAlert).length,
        expired: records.filter((record) => isConsentExpired(record.consentTo)).length
    };
}

export function activeSummaryFilter(typeFilter: TypeFilter, alertFilter: AlertFilter): SummaryFilter | "" {
    if (typeFilter === "youth" && alertFilter === "all") return "youth";
    if (typeFilter === "scouter" && alertFilter === "all") return "scouter";
    if (typeFilter === "all" && alertFilter === "medication") return "medication";
    if (typeFilter === "all" && alertFilter === "medical") return "medical";
    if (typeFilter === "all" && alertFilter === "expired") return "expired";
    if (typeFilter === "all" && alertFilter === "all") return "total";
    return "";
}

export function filtersForSummary(filter: SummaryFilter): { typeFilter: TypeFilter; alertFilter: AlertFilter } {
    if (filter === "youth") return { typeFilter: "youth", alertFilter: "all" };
    if (filter === "scouter") return { typeFilter: "scouter", alertFilter: "all" };
    if (filter === "medication") return { typeFilter: "all", alertFilter: "medication" };
    if (filter === "medical") return { typeFilter: "all", alertFilter: "medical" };
    if (filter === "expired") return { typeFilter: "all", alertFilter: "expired" };
    return { typeFilter: "all", alertFilter: "all" };
}

function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function consentRecordPrintHtml(record: ConsentAdminRecord): string {
    const rows = Object.entries(record.data)
        .filter(([key]) => key !== "submittedAt")
        .map(([key, value]) => {
            const text = displayValue(value);
            return text ? `<tr><th>${escapeHtml(formatFieldName(key))}</th><td><pre>${escapeHtml(text)}</pre></td></tr>` : "";
        })
        .join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(record.memberName || "Consent Record")} - Consent Record</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:32px;color:#1f2937;background:white}h1,h2{color:#081E67}h1{border-bottom:5px solid #F52D45;padding-bottom:14px}.summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px;background:#f8f9fa;border:1px solid #ddd;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #d1d5db;padding:10px;text-align:left;vertical-align:top}th{width:34%;background:#EEF1FA;color:#081E67}pre{white-space:pre-wrap;word-break:break-word;margin:0;font:inherit}.controls{margin-bottom:20px}button{padding:10px 18px;margin-right:10px;cursor:pointer}@media print{.controls{display:none}body{padding:0}@page{margin:15mm}}</style></head><body><div class="controls"><button onclick="window.print()">Print / Save as PDF</button><button onclick="window.close()">Close</button></div><h1>Consent Record</h1><h2>${escapeHtml(record.memberName || "Unknown member")}</h2><div class="summary"><div><strong>Section:</strong> ${escapeHtml(record.section || "Not provided")}</div><div><strong>Type:</strong> ${escapeHtml(record.type === "youth" ? "Youth" : "Scouter ES3")}</div><div><strong>Submitted:</strong> ${escapeHtml(formatDate(record.submittedAt))}</div><div><strong>Expiry:</strong> ${escapeHtml(expiryLabel(record))}</div></div><table><tbody>${rows}</tbody></table></body></html>`;
}
