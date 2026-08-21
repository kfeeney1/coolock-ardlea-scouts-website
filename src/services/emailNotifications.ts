import { auth } from "../firebase";
import type { JoinApplication } from "./joinApplications";
import type { ParentAccount } from "./parentPortal";

const emailApiUrl = (import.meta.env.VITE_EMAIL_API_URL || "").replace(/\/$/, "");

async function post(path: string, body: Record<string, unknown>, authenticated: boolean): Promise<void> {
    if (!emailApiUrl) {
        console.warn("VITE_EMAIL_API_URL is not configured; email notification skipped.");
        return;
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authenticated) {
        const user = auth.currentUser;
        if (!user) throw new Error("No signed-in user for authenticated email notification.");
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }

    const response = await fetch(`${emailApiUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Email service returned ${response.status}: ${detail}`);
    }
}

export async function notifyJoinApplication(applicationId: string, application: JoinApplication): Promise<void> {
    await post("/join-application", {
        applicationId,
        childName: `${application.childFirstName} ${application.childLastName}`.trim(),
        section: application.section,
        parentName: application.parentName
    }, false);
}

export async function notifyParentRegistration(): Promise<void> {
    await post("/parent-registration", {}, true);
}

export async function notifyParentAccessApproved(account: ParentAccount, childCount: number): Promise<void> {
    await post("/parent-access-approved", {
        email: account.email,
        displayName: account.displayName,
        childCount
    }, true);
}

export async function notifyParentAccessRejected(account: ParentAccount): Promise<void> {
    await post("/parent-access-rejected", {
        email: account.email,
        displayName: account.displayName
    }, true);
}

export async function notifyLeaderRegistration(): Promise<void> {
    await post("/leader-registration", {}, true);
}

export async function notifyLeaderAccessStatus(
    email: string,
    displayName: string,
    status: "approved" | "rejected",
    section: string
): Promise<void> {
    await post("/leader-access-status", { email, displayName, status, section }, true);
}

export async function notifyEventPublished(eventId: string, memberIds: string[]): Promise<void> {
    await post("/event-published", { eventId, memberIds }, true);
}
