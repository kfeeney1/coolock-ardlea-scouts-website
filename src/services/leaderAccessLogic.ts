import { sortScoutSections } from "./sectionOrder.ts";

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
