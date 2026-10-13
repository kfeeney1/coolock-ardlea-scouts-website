import { auth } from "../firebase";
import { ServiceFailure } from "./applicationErrors.ts";
import { requestBackend } from "./backendRequest.ts";
import { eventAudienceEndpoint } from "./eventAudienceEndpoint.ts";

export type EventAudienceSaveResult = {
  ok: true;
  eventId: string;
  invitedCount: number;
  newlyInvitedMemberIds: string[];
  removedMemberIds: string[];
  alreadyExists?: boolean;
};

export async function saveEventAudience(
  operation: "create" | "update",
  eventId: string,
  input: Record<string, unknown>,
  audience: { sectionIds: string[]; memberIds: string[] },
  confirmRemovals = false,
  preserveLegacyAudience = false
): Promise<EventAudienceSaveResult> {
  const endpoint = eventAudienceEndpoint({
    appEnv: import.meta.env.VITE_APP_ENV,
    firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    emailApiUrl: import.meta.env.VITE_EMAIL_API_URL
  });
  if (!endpoint) throw new ServiceFailure("Event backend is not configured.", "backend/service-not-configured");
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign-in is required.", "auth/unauthenticated");
  const result = await requestBackend<EventAudienceSaveResult>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ operation, eventId, input, audience, confirmRemovals, preserveLegacyAudience })
  });
  if (result?.ok !== true || result.eventId !== eventId) {
    throw new ServiceFailure("Event backend did not confirm persistence.", "backend/invalid-response");
  }
  return result;
}
