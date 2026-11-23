import { auth } from "../firebase";
import { requestBackend } from "./backendRequest";
import { hallBookingEndpoint } from "./hallBookingEndpoint";
import type { ConsentAdminRecord } from "./consentAdmin";

export type MemberMedicalRecord = Pick<ConsentAdminRecord, "id" | "memberName" | "section" | "data">;
export type MemberMedicalEntry = { consentId: string; name: string; section: string };

export async function readMemberMedical<T>(consentId: string | null): Promise<T> {
  const endpoint = hallBookingEndpoint({
    appEnv: import.meta.env.VITE_APP_ENV,
    firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    emailApiUrl: import.meta.env.VITE_EMAIL_API_URL,
    hallApiUrl: import.meta.env.VITE_HALL_BOOKING_API_URL
  });
  const user = auth.currentUser;
  if (!endpoint || !user) throw new Error("Member medical service is unavailable.");
  return requestBackend(new URL("/member-medical", endpoint).href, {
    method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ consentId }), cache: "no-store"
  });
}
