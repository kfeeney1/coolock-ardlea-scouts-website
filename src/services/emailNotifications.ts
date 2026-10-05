import { ServiceFailure } from "./applicationErrors.ts";
import { requestBackend } from "./backendRequest.ts";
import { auth } from "../firebase";
import type { JoinApplication } from "./joinApplications";
import type { ParentAccount } from "./parentPortal";

const emailApiUrl = (import.meta.env.VITE_EMAIL_API_URL || "").replace(/\/$/, "");

async function post<T = void>(path: string, body: Record<string, unknown>, authenticated: boolean): Promise<T> {
    if (!emailApiUrl) {
        throw new ServiceFailure("Email service is not configured.", "backend/service-not-configured");
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authenticated) {
        const user = auth.currentUser;
        if (!user) throw new ServiceFailure("Sign-in is required.", "auth/unauthenticated");
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }

    return requestBackend<T>(`${emailApiUrl}${path}`, {
        method: "POST", headers, body: JSON.stringify(body)
    });
}


export type RegisteredScouterOption = { uid: string; displayName: string; scoutingRole: string; sections: string[] };

export async function loadRegisteredScouterOptions(): Promise<RegisteredScouterOption[]> {
    const result = await post<{ ok: true; scouters: RegisteredScouterOption[] }>("/registered-scouters", {}, false);
    return Array.isArray(result.scouters) ? result.scouters : [];
}

export async function notifyJoinApplication(applicationId: string, _application?: JoinApplication): Promise<void> {
    await post("/join-application", { applicationId }, false);
}

export async function notifyJoinApplicationStatus(applicationId: string, status: "waiting-list" | "accepted"): Promise<void> {
    await post("/join-application-status", { applicationId, status }, true);
}

export async function resolveJoinConsentContext(joinToken: string): Promise<{ memberId: string }> {
    return await post<{ memberId: string }>("/join-consent-context", { joinToken }, true);
}

export async function notifyParentRegistration(): Promise<void> {
    await post("/parent-registration", {}, true);
}

export async function notifyParentAccessApproved(account: ParentAccount, _childCount: number): Promise<void> {
    await post("/parent-access-approved", { parentAccountUid: account.uid }, true);
}

export async function notifyParentAccessRejected(account: ParentAccount): Promise<void> {
    await post("/parent-access-rejected", { parentAccountUid: account.uid }, true);
}

export async function notifyLeaderRegistration(): Promise<void> {
    await post("/leader-registration", {}, true);
}

export async function notifyLeaderAccessStatus(
    leaderRequestUid: string,
    status: "approved" | "rejected"
): Promise<void> {
    await post("/leader-access-status", { leaderRequestUid, status }, true);
}

export type EventNotificationKind = "notice" | "update" | "reminder";

export async function notifyEventParents(
    eventId: string,
    memberIds: string[],
    consentToken: string,
    kind: EventNotificationKind
): Promise<void> {
    await post("/event-notification", { eventId, memberIds, consentToken, kind }, true);
}

export async function notifyEventConsentProcessed(eventId: string, memberId: string): Promise<void> {
    await post("/event-consent-processed", { eventId, memberId }, true);
}

export async function notifyFormReminder(memberIds: string[], reminderKey: string): Promise<LeaderCommunicationResult> {
    return await post<LeaderCommunicationResult>("/form-reminder", { memberIds, reminderKey }, true);
}

export async function notifyEquipmentIncident(incidentId: string): Promise<void> {
    await post("/equipment-incident", { incidentId }, true);
}

export type LeaderCommunicationResult = {
    ok: true;
    sent: number;
    accepted?: number;
    deliveryState?: "accepted" | "queued";
    skipped: number;
    skippedReasons?: Record<string, number>;
};

export async function sendLeaderCommunication(
    memberIds: string[],
    subject: string,
    message: string
): Promise<LeaderCommunicationResult> {
    if (!emailApiUrl) {
        throw new Error("VITE_EMAIL_API_URL is not configured.");
    }
    return await post<LeaderCommunicationResult>(
        "/leader-communication",
        { memberIds, subject, message },
        true
    );
}

export type MemberInactivationContext = {
    ok: true;
    member: {
        id: string;
        displayName: string;
        section: string;
        status: "active" | "inactive" | "left";
    };
};

export async function loadMemberInactivationContext(actionToken: string): Promise<MemberInactivationContext> {
    if (!emailApiUrl) throw new Error("VITE_EMAIL_API_URL is not configured.");
    return await post<MemberInactivationContext>("/member-inactivation-context", { actionToken }, true);
}

export type MemberInactivationResult = {
    ok: true;
    alreadyInactive: boolean;
    status: "inactive" | "left";
};

export async function confirmMemberInactivation(actionToken: string): Promise<MemberInactivationResult> {
    if (!emailApiUrl) throw new Error("VITE_EMAIL_API_URL is not configured.");
    return await post<MemberInactivationResult>("/member-inactivation", { actionToken, confirm: true }, true);
}
