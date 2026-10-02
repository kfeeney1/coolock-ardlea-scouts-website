import { sortScoutSections } from "./sectionOrder.ts";
import {
    isGroupScopedAppointment,
    normalizeScoutingAppointmentAssignments,
    type ScoutingAppointmentAssignment
} from "../security/scoutingAppointments.ts";

export type NormalizedLeaderRole = "leader" | "admin" | "super-admin";

export type LeaderAccessSource = {
    role?: unknown;
    sections?: unknown;
    section?: unknown;
};

export function normalizeLeaderRole(value: unknown): NormalizedLeaderRole {
    if (value === "leader" || value === "admin" || value === "super-admin") return value;
    throw new Error("Leader profile contains an unsupported role.");
}

export function normalizeLeaderSections(data: LeaderAccessSource): string[] {
    const source = Array.isArray(data.sections)
        ? data.sections
        : typeof data.sections === "string"
          ? [data.sections]
          : typeof data.section === "string"
            ? [data.section]
            : [];

    return sortScoutSections(
        source.filter((value): value is string => typeof value === "string")
    );
}

export function canonicalOrganisationSection(sections: readonly string[], legacySection: unknown): string {
    const legacy = typeof legacySection === "string" ? legacySection.trim() : "";
    if (legacy && sections.includes(legacy)) return legacy;
    return sections.find((section) => section !== "Group") || sections[0] || "Group";
}

export function canonicalLeaderAppointments(
    value: unknown,
    sections: readonly string[],
    legacyAppointment: unknown = "",
    legacySection: unknown = "Group"
): ScoutingAppointmentAssignment[] {
    const canonicalSection = canonicalOrganisationSection(sections, legacySection);
    const sectionScopes = new Set(sections.filter((section) => section !== "Group"));
    const result = new Map<string, ScoutingAppointmentAssignment>();
    for (const item of normalizeScoutingAppointmentAssignments(value, legacyAppointment, canonicalSection)) {
        const canonical = isGroupScopedAppointment(item.appointment)
            ? { ...item, id: `${item.appointment.toLowerCase().replace(/[^a-z0-9]+/g, "-")}--group`, scope: "Group" }
            : sectionScopes.has(item.scope)
              ? item
              : {
            ...item,
            id: `${item.appointment.toLowerCase().replace(/[^a-z0-9]+/g, "-")}--${canonicalSection.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            scope: canonicalSection
        };
        if (!result.has(canonical.id)) result.set(canonical.id, canonical);
    }
    return [...result.values()];
}


export const YOUTH_SECTION_NAMES = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"] as const;

export function effectiveOperationalSections(
    role: NormalizedLeaderRole,
    sections: readonly string[],
    appointments: readonly ScoutingAppointmentAssignment[]
): string[] {
    if (role === "admin" || role === "super-admin") return [...YOUTH_SECTION_NAMES];
    const active = appointments.filter((item) => item.active !== false);
    if (active.some((item) => item.appointment === "Group Leader" || item.appointment === "Deputy Group Leader")) {
        return [...YOUTH_SECTION_NAMES];
    }
    const accountSections = new Set(sections.filter((section) => section !== "Group"));
    active.forEach((item) => {
        if (!isGroupScopedAppointment(item.appointment) && item.scope !== "Group") accountSections.add(item.scope);
    });
    return sortScoutSections([...accountSections]);
}

export function canManageOperationalSection(
    role: NormalizedLeaderRole,
    sections: readonly string[],
    appointments: readonly ScoutingAppointmentAssignment[],
    section: string
): boolean {
    return effectiveOperationalSections(role, sections, appointments).includes(section);
}


export type LeaderAccessOrderRecord = {
    displayName: string;
    uid: string;
    primarySection: string;
};

export function sortLeaderAccessRecords<T extends LeaderAccessOrderRecord>(
    records: readonly T[],
    sectionFilter: string
): T[] {
    return [...records].sort((left, right) => {
        if (sectionFilter) {
            const leftIsPrimary = left.primarySection === sectionFilter;
            const rightIsPrimary = right.primarySection === sectionFilter;
            if (leftIsPrimary !== rightIsPrimary) return leftIsPrimary ? -1 : 1;
        }

        return left.displayName.localeCompare(right.displayName) || left.uid.localeCompare(right.uid);
    });
}
