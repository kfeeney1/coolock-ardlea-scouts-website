import {hallBookingEndpoint} from "./hallBookingEndpoint.ts";
import { auth } from "../firebase";
import { requestBackend } from "./backendRequest.ts";
import { ServiceFailure, UserFacingError } from "./applicationErrors.ts";
import { hallBookingInput, validateHallBookingInput, type HallBookingInput, type HallBookingRecord } from "./hallBookingAdministration.ts";
type Page<T> = {items: {key: string; value: T}[]; cursor: string};
export type HallHistory = {actorUid: string; at: string; previous: HallBookingRecord | null; next: HallBookingRecord};
export async function requestHallBooking<T>(body: Record<string, unknown>): Promise<T> {
  const endpoint = hallBookingEndpoint({appEnv: import.meta.env.VITE_APP_ENV, firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, emailApiUrl: import.meta.env.VITE_EMAIL_API_URL, hallApiUrl: import.meta.env.VITE_HALL_BOOKING_API_URL});
  if (!endpoint) throw new UserFacingError("Hall booking service is not configured.");
  const user = auth.currentUser;
  if (!user) throw new UserFacingError("Sign in to manage hall bookings.");
  try {
    const result = await requestBackend<T & {ok: boolean}>(endpoint, {method: "POST", headers: {"Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}`}, body: JSON.stringify(body)});
    if (result?.ok !== true) throw new ServiceFailure("Invalid hall booking response.", "backend/invalid-response");
    return result;
  } catch (error) {
    if (error instanceof ServiceFailure && error.status === 409) throw new UserFacingError("This change could not be saved. Check current bookings and source records for conflicts or reconciliation. Your edits are retained.");
    if (error instanceof ServiceFailure && [401, 403].includes(error.status ?? 0)) throw new UserFacingError("Current Group Council membership is required to manage hall bookings.");
    if (error instanceof ServiceFailure && error.status === 400) throw new UserFacingError("Check booking dates and details. Shorten a series that affects too many days.");
    throw error;
  }
}
function record(value: HallBookingRecord): HallBookingRecord {
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 1 || [value.title, value.hirerName, value.contact, value.notes, value.createdBy, value.createdAt, value.updatedBy, value.updatedAt].some(field => typeof field !== "string") || validateHallBookingInput(value)) throw new UserFacingError("The booking service returned an invalid record.");
  return value;
}
function page<T>(value: Page<T>, check: (item: T) => T): Page<T> {
  if (!value || !Array.isArray(value.items) || value.items.length > 50 || typeof value.cursor !== "string" || value.items.some(item => typeof item.key !== "string")) throw new UserFacingError("The booking service returned an invalid page.");
  return {...value, items: value.items.map(item => ({...item, value: check(item.value)}))};
}
export async function listHallBookings(cursor = "") {return page(await requestHallBooking<Page<HallBookingRecord>>({action: "list", cursor}), record);}
export async function getHallBooking(id: string) {const result = await requestHallBooking<{item: HallBookingRecord | null}>({action: "get", id}); return result.item ? record(result.item) : null;}
export async function hallBookingHistory(id: string, cursor = "") {
  return page(await requestHallBooking<Page<HallHistory>>({action: "history", id, cursor}), value => {if (!value || typeof value.actorUid !== "string" || typeof value.at !== "string") throw new UserFacingError("Invalid booking history."); record(value.next); return value;});
}
export async function persistHallBooking(booking: HallBookingInput, expectedRevision: number) {
  const validation = validateHallBookingInput(booking); if (validation) throw new UserFacingError(validation);
  const result = await requestHallBooking<{id: string; revision: number}>({action: "save", command: {booking: hallBookingInput(booking), expectedRevision}});
  if (result.id !== booking.id || result.revision !== expectedRevision + 1) throw new UserFacingError("The booking save was not confirmed. Reload bookings before trying again.");
  return result;
}
