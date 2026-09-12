import type { MemberRecord } from "./memberAdmin";

export type ParentChildRequest = {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
};

export type ParentChildMatch = {
    request: ParentChildRequest;
    outcome: "matched" | "none" | "ambiguous";
    candidateMemberId: string | null;
    candidateCount: number;
};

export function normalizeIdentityPart(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IE");
}

export function normalizeParentChildRequest(request: ParentChildRequest): ParentChildRequest {
    return {
        firstName: request.firstName.trim().replace(/\s+/g, " ").slice(0, 80),
        lastName: request.lastName.trim().replace(/\s+/g, " ").slice(0, 100),
        dateOfBirth: request.dateOfBirth.trim()
    };
}

export function isValidParentChildRequest(request: ParentChildRequest): boolean {
    const normalized = normalizeParentChildRequest(request);
    if (!normalized.firstName || !normalized.lastName || !/^\d{4}-\d{2}-\d{2}$/.test(normalized.dateOfBirth)) return false;
    const parsed = new Date(`${normalized.dateOfBirth}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized.dateOfBirth;
}

export function dedupeParentChildRequests(requests: ParentChildRequest[]): ParentChildRequest[] {
    const seen = new Set<string>();
    const result: ParentChildRequest[] = [];
    for (const raw of requests) {
        const request = normalizeParentChildRequest(raw);
        if (!isValidParentChildRequest(request)) continue;
        const key = `${normalizeIdentityPart(request.firstName)}|${normalizeIdentityPart(request.lastName)}|${request.dateOfBirth}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(request);
    }
    return result;
}

export function matchParentChildRequest(request: ParentChildRequest, members: MemberRecord[]): ParentChildMatch {
    const normalized = normalizeParentChildRequest(request);
    const candidates = members.filter((member) =>
        member.status !== "left" &&
        normalizeIdentityPart(member.firstName) === normalizeIdentityPart(normalized.firstName) &&
        normalizeIdentityPart(member.lastName) === normalizeIdentityPart(normalized.lastName) &&
        member.dateOfBirth.trim() === normalized.dateOfBirth
    );

    if (candidates.length === 1) {
        return { request: normalized, outcome: "matched", candidateMemberId: candidates[0].id, candidateCount: 1 };
    }
    return {
        request: normalized,
        outcome: candidates.length === 0 ? "none" : "ambiguous",
        candidateMemberId: null,
        candidateCount: candidates.length
    };
}

export function matchParentChildRequests(requests: ParentChildRequest[], members: MemberRecord[]): ParentChildMatch[] {
    return dedupeParentChildRequests(requests).map((request) => matchParentChildRequest(request, members));
}
