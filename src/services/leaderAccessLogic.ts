export type NormalizedLeaderRole = "leader" | "admin" | "super-admin";

export type LeaderAccessSource = {
    role?: unknown;
    sections?: unknown;
};

export function normalizeLeaderRole(value: unknown): NormalizedLeaderRole {
    if (value === "leader" || value === "admin" || value === "super-admin") return value;
    throw new Error("Leader profile contains an unsupported role.");
}

export function normalizeLeaderSections(data: LeaderAccessSource): string[] {
    if (!Array.isArray(data.sections)) return [];

    return [...new Set(
        data.sections
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
    )];
}
