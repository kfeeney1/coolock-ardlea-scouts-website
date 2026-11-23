import { auth } from "../firebase";
import { requestBackend } from "./backendRequest";
import { hallBookingEndpoint } from "./hallBookingEndpoint";

export async function loadChairpersonReport<Row>(report: "membership" | "minutes"): Promise<Row[]> {
  const endpoint = hallBookingEndpoint({
    appEnv: import.meta.env.VITE_APP_ENV, firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    emailApiUrl: import.meta.env.VITE_EMAIL_API_URL, hallApiUrl: import.meta.env.VITE_HALL_BOOKING_API_URL
  });
  const user = auth.currentUser;
  if (!endpoint || !user) throw new Error("Report service is unavailable.");
  const result = await requestBackend<{ rows: Row[] }>(new URL("/chairperson-reports", endpoint).href, {
    method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ report }), cache: "no-store"
  });
  return result.rows;
}
