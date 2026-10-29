import { hallOccurrences, hallOverlaps } from "../../src/services/hallBookingDomain.ts";
import { groupLocalDate } from "../../src/services/groupLocalDate.ts";
import { hallInstant, addHallDays } from "../../src/services/hallBookingTime.ts";
import { canManageHallBookings } from "../../src/security/hallBookingAccess.ts";

export class HallBookingError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const hallFailure = (status, code, message) => { throw new HallBookingError(status, code, message); };
export const hallId = value => typeof value === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(value);
const plain = value => value && typeof value === "object" && !Array.isArray(value);
function exact(value, keys) {
  if (!plain(value) || Object.keys(value).some(key => !keys.includes(key))) hallFailure(400, "hall/invalid", "Invalid booking fields.");
}
function text(value, max) {
  if (typeof value !== "string" || value.length > max) hallFailure(400, "hall/invalid", "Invalid booking details.");
  return value.trim();
}
function interval(value) {
  exact(value, ["date", "startTime", "endDate", "endTime"]);
  return {date: text(value.date, 10), startTime: text(value.startTime, 5), endDate: text(value.endDate, 10), endTime: text(value.endTime, 5)};
}
export function cleanHallBooking(input) {
  exact(input, ["id", "resourceId", "kind", "state", "interval", "recurrence", "exceptions", "title", "hirerName", "contact", "notes"]);
  if (!hallId(input.id)) hallFailure(400, "hall/invalid", "Invalid booking reference.");
  const value = {id: input.id, resourceId: input.resourceId, kind: input.kind, state: input.state, interval: interval(input.interval), title: text(input.title, 200), hirerName: text(input.hirerName, 200), contact: text(input.contact, 300), notes: text(input.notes, 3000)};
  if (!value.title) hallFailure(400, "hall/invalid", "A booking title is required.");
  if (input.recurrence !== undefined) {
    exact(input.recurrence, ["frequency", "until"]);
    value.recurrence = {frequency: input.recurrence.frequency, until: text(input.recurrence.until, 10)};
  }
  if (input.exceptions !== undefined) {
    if (!Array.isArray(input.exceptions) || input.exceptions.length > 53) hallFailure(400, "hall/invalid", "Too many occurrence exceptions.");
    value.exceptions = input.exceptions.map(item => {
      exact(item, item?.action === "replace" ? ["date", "action", "interval"] : ["date", "action"]);
      return {date: text(item.date, 10), action: item.action, ...(item.action === "replace" ? {interval: interval(item.interval)} : {})};
    });
  }
  try { hallOccurrences(value); } catch { hallFailure(400, "hall/invalid", "Check booking dates, times, recurrence and exceptions. Dublin clock-change times must be unambiguous."); }
  return value;
}

/** Day partitions are internal lock indexes, never public booking records. */
export function occupiedHallDays(booking) {
  const days = new Map();
  for (const occurrence of hallOccurrences(booking)) {
    for (let date = groupLocalDate(new Date(occurrence.start)); hallInstant(date, "00:00") < occurrence.end; date = addHallDays(date, 1)) {
      const values = days.get(date) ?? [];
      values.push({start: occurrence.start, end: occurrence.end}); days.set(date, values);
      if (hallInstant(date, "23:59") + 60_000 >= occurrence.end) break;
    }
  }
  return days;
}

export function assertHallCouncil(profile, organisation, now) {
  if (!canManageHallBookings(profile, organisation, groupLocalDate(new Date(now)))) hallFailure(403, "hall/forbidden", "Group Council membership is required to manage hall bookings.");
}

/** Runs only inside the trusted store transaction; no client-supplied occupancy or actor grants. */
export async function saveHallBooking(store, uid, command, now = Date.now()) {
  exact(command, ["booking", "expectedRevision"]);
  const booking = cleanHallBooking(command.booking), expected = command.expectedRevision;
  if (!Number.isSafeInteger(expected) || expected < 0 || expected > 1_000_000) hallFailure(400, "hall/invalid", "Invalid booking revision.");
  return store.transaction(async tx => {
    const paths = ["hall/group", `adminUsers/${uid}`, `organisationLeadership/${uid}`, "siteSettings/hallHire", `hall/group/bookings/${booking.id}`];
    const [lock, profile, organisation, setting, previous] = await tx.read(paths);
    assertHallCouncil(profile, organisation, now);
    // Readiness is authoritative and remains false until source integration is complete.
    if (setting?.enabled !== true || lock?.ready !== true) hallFailure(409, "hall/disabled", "Hall booking administration is not enabled.");
    if ((previous?.revision ?? 0) !== expected) hallFailure(409, "hall/stale", "This booking changed. Reload it before saving.");
    if (previous?.source) hallFailure(409, "hall/source-owned", "Change this reservation through its original meeting, event or maintenance record.");
    const nextDays = occupiedHallDays(booking), oldDays = previous ? occupiedHallDays(previous) : new Map();
    const dates = [...new Set([...oldDays.keys(), ...nextDays.keys()])].sort();
    // Two writes/day plus canonical record, lock and two audit writes stay below 500.
    if (dates.length > 240) hallFailure(400, "hall/bounds", "This change affects too many days. Shorten or split the booking series.");
    const buckets = await tx.read(dates.map(date => `hall/group/days/${date}`));
    const revision = expected + 1, timestamp = new Date(now).toISOString();
    const next = {...booking, revision, createdBy: previous?.createdBy ?? uid, createdAt: previous?.createdAt ?? timestamp, updatedBy: uid, updatedAt: timestamp};
    for (let index = 0; index < dates.length; index++) {
      const existing = buckets[index]?.reservations ?? [];
      if (!Array.isArray(existing) || existing.length > 300 || existing.some(item => !hallId(item.bookingId) || !Number.isFinite(item.start) || !Number.isFinite(item.end) || item.start >= item.end)) hallFailure(409, "hall/index", "Hall availability needs reconciliation before saving.");
      const others = existing.filter(item => item.bookingId !== booking.id), incoming = nextDays.get(dates[index]) ?? [];
      if (others.some(item => incoming.some(value => hallOverlaps(item, value)))) hallFailure(409, "hall/conflict", "This time overlaps an existing hall reservation. Choose another time.");
      const reservations = [...others, ...incoming.map(value => ({bookingId: booking.id, ...value}))].sort((a, b) => a.start - b.start);
      if (reservations.length > 300) hallFailure(400, "hall/bounds", "This day has too many occupied slots.");
      tx.set(`hall/group/days/${dates[index]}`, {reservations});
      // The public collection is a deliberately restricted representation with no source IDs.
      const dayStart = hallInstant(dates[index], "00:00"), dayEnd = hallInstant(dates[index], "23:59") + 60_000;
      tx.set(`hallAvailability/${dates[index]}`, {occupied: reservations.map(({start, end}) => ({start: new Date(Math.max(start, dayStart)).toISOString(), end: new Date(Math.min(end, dayEnd)).toISOString()}))});
    }
    tx.set(`hall/group/bookings/${booking.id}`, next);
    tx.set("hall/group", {...lock, revision: (lock.revision ?? 0) + 1});
    tx.create(`hall/group/bookings/${booking.id}/history/${revision}`, {actorUid: uid, at: timestamp, previous: previous ?? null, next});
    tx.create(`auditLog/hall-${booking.id}-${revision}`, {category: "system", action: "hall-booking-save", actorUid: uid, actorEmail: "", targetId: booking.id, targetLabel: "Hall booking", description: `Hall booking revision ${revision}: ${booking.state}`, section: "Group", createdAt: new Date(now)});
    return {id: booking.id, revision};
  });
}
