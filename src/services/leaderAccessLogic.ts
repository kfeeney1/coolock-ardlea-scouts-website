export type NormalizedLeaderRole = "leader" | "admin" | "super-admin";

export type LeaderAccessSource = {
    role?: unknown;
    sections?: unknown;
    section?: unknown;
};

export function normalizeLeaderRole(value: unknown): NormalizedLeaderRole {
    return value === "super-admin" || value === "admin" ? value : "leader";
}

export function normalizeLeaderSections(data: LeaderAccessSource): string[] {
    if (Array.isArray(data.sections)) {
        return data.sections.filter((value): value is string => typeof value === "string" && value.length > 0);
    }

    return typeof data.section === "string" && data.section.length > 0 ? [data.section] : [];
}
