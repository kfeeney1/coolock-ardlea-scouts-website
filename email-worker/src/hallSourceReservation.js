import { cleanHallBooking, hallFailure, writeHallReservation } from "./hallBookingModel.js";

const roots = {meeting: "weeklyMeetings", event: "events", maintenance: "maintenance/group/appointments"};

/** Unambiguous UTF-8 digest: never truncate IDs or collide across source collections. */
export async function hallSourceIdentity(kind, id) {
  if (!Object.hasOwn(roots, kind) || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) hallFailure(400, "hall/source", "Invalid hall source reference.");
  const path = `${roots[kind]}/${id}`;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(path));
  return {path, bookingId: `source-${[...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("")}`};
}

function sourceBooking(id, occupancy, previous) {
  if (occupancy === null) {
    if (!previous) return null;
    return cleanHallBooking({id, resourceId: "group-hall", kind: previous.kind, state: "cancelled", interval: previous.interval,
      ...(previous.recurrence ? {recurrence: previous.recurrence} : {}), ...(previous.exceptions ? {exceptions: previous.exceptions} : {}),
      title: "Source reservation", hirerName: "", contact: "", notes: ""});
  }
  if (!occupancy || typeof occupancy !== "object" || Array.isArray(occupancy)
    || Object.keys(occupancy).some(key => !["resourceId", "interval", "recurrence", "exceptions", "state", "kind"].includes(key))) hallFailure(400, "hall/source", "Invalid source occupancy.");
  return cleanHallBooking({...occupancy, id, title: "Source reservation", hirerName: "", contact: "", notes: ""});
}

/**
 * Trusted server adapters only; deliberately not registered as an HTTP action.
 * prepare must read source permissions/current revision in tx, reject unauthorised
 * writes, and return {authorised:true, occupancy, persist}. persist stages the
 * canonical write(s) only: all reads must finish in prepare. Null occupancy means
 * explicitly non-hall, cancelled or deleted; it never infers from free-text location.
 * The full prepare callback reruns on native transaction abort, never using stale
 * source authority or browser-supplied occupancy. Callers must verify user identity.
 */
export async function saveSourceHallReservation(store, uid, kind, id, prepare, now = Date.now()) {
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid) || typeof prepare !== "function") hallFailure(403, "hall/forbidden", "A trusted source writer is required.");
  const {path, bookingId} = await hallSourceIdentity(kind, id);
  return store.transaction(async tx => {
    const [lock, previous, current] = await tx.read(["hall/group", `hall/group/bookings/${bookingId}`, path]);
    if (previous && (previous.source?.collection !== roots[kind] || previous.source?.id !== id)) hallFailure(409, "hall/source-owned", "The source reservation requires reconciliation.");
    const prepared = await prepare(tx, {path, current});
    if (prepared?.authorised !== true || typeof prepared.persist !== "function") hallFailure(403, "hall/forbidden", "Source write permission is required.");
    const booking = sourceBooking(bookingId, prepared.occupancy, previous);
    // Rollout/readiness intentionally do not gate conflict checks for canonical writes.
    const result = booking ? await writeHallReservation(tx, {booking: {...booking, source: {collection: roots[kind], id}}, previous, lock, uid, now}) : null;
    await prepared.persist(tx);
    return result;
  });
}
