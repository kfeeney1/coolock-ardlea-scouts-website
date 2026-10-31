import {cleanHallBooking, occupiedHallDays, hallId} from "../email-worker/src/hallBookingModel.js";
import {hallSourceIdentity} from "../email-worker/src/hallSourceReservation.js";
import {hallDate, hallInstant, addHallDays, DAY_MS} from "../src/services/hallBookingTime.ts";

export const HALL_AUDIT_LIMIT = 1000;
export const HALL_AUDIT_COLLECTIONS = {
  weeklyMeetings: ["meetingDate", "status", "hallResource", "hallRevision", "hallStartTime", "hallEndTime"],
  events: ["startDate", "endDate", "status", "hallResource", "hallRevision", "hallInterval"],
  "maintenance/group/appointments": ["date", "allDay", "startTime", "endTime", "hallResource", "revision", "cancelled", "taskId"],
  "hall/group/bookings": ["id", "resourceId", "kind", "state", "interval", "recurrence", "exceptions", "source", "revision"],
  "hall/group/days": null,
  hallAvailability: null
};
const kinds = {weeklyMeetings: "meeting", events: "event", "maintenance/group/appointments": "maintenance"};
const plain = value => value && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const occupation = value => Object.fromEntries(["id", "resourceId", "kind", "state", "interval", "recurrence", "exceptions", "source"].filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
const positive = value => Number.isSafeInteger(value) && value > 0;
const version = value => typeof value === "string" && /^\d{1,12}:\d{1,9}$/.test(value);
const reference = (collection, id) => `${collection}/${typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : "<invalid-id>"}`;
const stable = value => Array.isArray(value) ? value.map(stable) : plain(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const same = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));
const sorted = slots => slots.slice().sort((a, b) => a.start - b.start || a.end - b.end || String(a.bookingId ?? "").localeCompare(String(b.bookingId ?? "")));
function intervalFor(collection, data) {
  if (collection === "events") return data.hallInterval;
  if (collection === "weeklyMeetings") return {date: data.meetingDate, startTime: data.hallStartTime, endDate: data.meetingDate, endTime: data.hallEndTime};
  return {date: data.date, startTime: data.allDay ? "00:00" : data.startTime, endDate: data.allDay ? addHallDays(data.date, 1) : data.date, endTime: data.allDay ? "00:00" : data.endTime};
}
function dateRange(collection, data) {
  const from = collection === "events" ? data.startDate : collection === "weeklyMeetings" ? data.meetingDate : data.date;
  const through = collection === "events" ? data.endDate : from;
  if (hallDate(through) < hallDate(from)) throw new Error("source dates");
  return {from, through};
}
export function validateHallAuditOptions({from, through, decisions = []}) {
  const span = (hallDate(through) - hallDate(from)) / DAY_MS;
  if (span < 0 || span > 365 || !Array.isArray(decisions) || decisions.length > 3 * HALL_AUDIT_LIMIT) throw new Error("Invalid audit options.");
  const seen = new Set();
  for (const decision of decisions) {
    if (!exact(decision, ["path", "version", "resource"]) || !version(decision.version) || !["none", "group-hall"].includes(decision.resource)
      || typeof decision.path !== "string" || !/^(weeklyMeetings|events|maintenance\/group\/appointments)\/[A-Za-z0-9_-]{1,128}$/.test(decision.path) || seen.has(decision.path)) throw new Error("Invalid audit decisions.");
    seen.add(decision.path);
  }
  return {from, through, decisions};
}

/** Pure, bounded diagnosis. Results contain static codes and references, never field values. */
export async function auditHallReservations(snapshot, options) {
  const {from, through, decisions} = validateHallAuditOptions(options);
  const issues = [], inventory = [], expected = new Map(), sourceBookings = new Map();
  const issue = (code, path) => {if (issues.length < 4000) issues.push({code, path});};
  const records = collection => snapshot.collections.get(collection) ?? new Map();
  const decisionsByPath = new Map(decisions.map(value => [value.path, value]));
  const used = new Set();
  const dates = [];
  for (let date = from; date <= through; date = date === through ? "~" : addHallDays(date, 1)) dates.push(date);
  for (const collection of new Set([...(snapshot.truncated ?? []), ...Object.keys(HALL_AUDIT_COLLECTIONS).filter(name => records(name).size > HALL_AUDIT_LIMIT)])) issue("scan-limit", collection);
  let expanded = 0;
  const bookings = records("hall/group/bookings");
  for (const [id, raw] of bookings) {
    const path = reference("hall/group/bookings", id);
    if (!positive(raw.revision)) issue("invalid-revision", path);
    if (raw.source !== undefined) {
      if (!exact(raw.source, ["collection", "id"]) || !Object.hasOwn(kinds, raw.source.collection)) issue("invalid-owner", path);
      else {
        try {
          const owner = await hallSourceIdentity(kinds[raw.source.collection], raw.source.id);
          if (owner.bookingId !== id) issue("noncanonical-source-id", path);
          const list = sourceBookings.get(owner.path) ?? []; list.push({id, raw}); sourceBookings.set(owner.path, list);
          if (!records(raw.source.collection).has(raw.source.id)) issue("orphaned-source", path);
        } catch {issue("invalid-owner", path);}
      }
    }
    try {
      const booking = cleanHallBooking({id: raw.id, resourceId: raw.resourceId, kind: raw.kind, state: raw.state, interval: raw.interval,
        ...(raw.recurrence === undefined ? {} : {recurrence: raw.recurrence}), ...(raw.exceptions === undefined ? {} : {exceptions: raw.exceptions}), title: "Audit", hirerName: "", contact: "", notes: ""});
      if (raw.id !== id) issue("booking-id-mismatch", path);
      const days = occupiedHallDays(booking);
      if (days.size > 240) issue("booking-write-bound", path);
      for (const [date, slots] of days) {
        expanded += slots.length;
        if (expanded > 20_000) break;
        if (date < from || date > through) continue;
        const values = expected.get(date) ?? [];
        values.push(...slots.map(slot => ({bookingId: id, ...slot}))); expected.set(date, values);
      }
    } catch {issue("invalid-booking", path);}
    const evidence = snapshot.evidence?.get(id);
    if (!evidence?.history || evidence.history.next?.id !== id || evidence.history.next?.revision !== raw.revision
      || !same(occupation(evidence.history.next), occupation(raw)) || typeof evidence.history.actorUid !== "string" || !evidence.history.actorUid || typeof evidence.history.at !== "string") issue("history-head-mismatch", path);
    if (!evidence?.audit || evidence.audit.action !== "hall-booking-save" || evidence.audit.targetId !== id || typeof evidence.audit.actorUid !== "string" || !evidence.audit.actorUid || evidence.audit.actorUid !== evidence.history?.actorUid) issue("audit-head-mismatch", path);
    if (expanded > 20_000) {issue("expansion-limit", "hall/group/bookings"); break;}
  }
  for (const [collection, kind] of Object.entries(kinds)) {
    for (const [id, data] of records(collection)) {
      const path = reference(collection, id), linked = sourceBookings.get(path) ?? [];
      if (linked.length > 1) issue("duplicate-source-reservations", path);
      let relevant = true;
      try {const range = dateRange(collection, data); relevant = range.from <= through && range.through >= from;}
      catch {issue("invalid-source-dates", path);}
      if (!["open", "closed", ...(kind === "event" ? ["draft", "completed"] : [])].includes(data.status) && kind !== "maintenance") issue("invalid-source-state", path);
      if (kind === "maintenance" && (typeof data.allDay !== "boolean" || (data.cancelled !== undefined && typeof data.cancelled !== "boolean"))) issue("invalid-source-state", path);
      if (typeof id !== "string" || !(kind === "maintenance" ? /^(?:[a-zA-Z0-9-]{20,64}|task-[a-zA-Z0-9-]{20,64})$/.test(id) : /^[A-Za-z0-9_-]{1,100}$/.test(id))) issue("unsupported-source-id", path);
      const sourceRevision = kind === "maintenance" ? data.revision : data.hallRevision;
      const released = linked.length === 1 && linked[0].raw.state === "cancelled" && positive(sourceRevision);
      const marked = data.hallResource === "group-hall", currentVersion = snapshot.versions?.get(path);
      const decision = decisionsByPath.get(path);
      if (decision) {used.add(path); if (decision.version !== currentVersion) issue("stale-decision", path);}
      if (marked) {
        try {
          const {bookingId} = await hallSourceIdentity(kind, id);
          if (kind === "event" && (data.hallInterval?.date < data.startDate || data.hallInterval?.endDate > data.endDate)) issue("source-interval-outside-event", path);
          const canonical = bookings.get(bookingId), cancelled = collection === "maintenance/group/appointments" && data.cancelled === true;
          const revision = collection === "maintenance/group/appointments" ? data.revision : data.hallRevision;
          if (!positive(revision)) issue("invalid-source-revision", path);
          if (!canonical) issue("missing-source-reservation", path);
          else if (!same(canonical.source, {collection, id}) || canonical.kind !== (kind === "maintenance" ? "blocked" : "internal") || canonical.state !== (cancelled ? "cancelled" : "confirmed")
            || !same(canonical.interval, intervalFor(collection, data)) || canonical.recurrence !== undefined || (canonical.exceptions?.length ?? 0) !== 0) issue("source-schedule-mismatch", path);
        } catch {issue("invalid-source-schedule", path);}
        if (decision?.resource === "none") issue("decision-source-mismatch", path);
      } else {
        if (linked.some(value => value.raw.state !== "cancelled")) issue("unreleased-source-reservation", path);
        if (relevant && !released) {
          if (!version(currentVersion)) issue("missing-source-version", path);
          inventory.push({path, version: version(currentVersion) ? currentVersion : null});
          if (!decision) issue("unconfirmed-source-use", path);
          else if (decision.resource === "group-hall") issue("confirmed-hall-needs-reservation", path);
        }
        if (released && decision?.resource === "group-hall") issue("decision-source-mismatch", path);
        if (data.hallResource !== undefined && data.hallResource !== "") issue("unsupported-source-resource", path);
      }
    }
  }
  for (const path of decisionsByPath.keys()) if (!used.has(path)) issue("orphaned-decision", path);
  for (const date of dates) {
    const wanted = sorted(expected.get(date) ?? []), day = records("hall/group/days").get(date), publicDay = records("hallAvailability").get(date);
    if (wanted.some((value, index) => wanted.slice(0, index).some(other => other.end > value.start))) issue("overlapping-bookings", `hall/group/days/${date}`);
    if (wanted.length > 300) issue("day-slot-limit", `hall/group/days/${date}`);
    const validDay = day === undefined ? wanted.length === 0 : exact(day, ["reservations"]) && Array.isArray(day.reservations) && day.reservations.every(value => exact(value, ["bookingId", "start", "end"]) && hallId(value.bookingId) && Number.isFinite(value.start) && Number.isFinite(value.end) && value.end > value.start);
    if (!validDay || !same(sorted(day?.reservations ?? []), wanted)) issue("day-index-mismatch", `hall/group/days/${date}`);
    const start = hallInstant(date, "00:00"), end = hallInstant(date, "23:59") + 60_000;
    const wantedPublic = wanted.map(slot => ({start: new Date(Math.max(slot.start, start)).toISOString(), end: new Date(Math.min(slot.end, end)).toISOString()}));
    if (publicDay === undefined ? wantedPublic.length > 0 : !same(publicDay.occupied, wantedPublic)) issue("public-availability-mismatch", `hallAvailability/${date}`);
  }
  for (const [id, data] of records("hall/group/days")) {
    try {hallDate(id);} catch {issue("invalid-index-date", reference("hall/group/days", id));}
    if (!exact(data, ["reservations"]) || !Array.isArray(data.reservations) || data.reservations.length > 300 || data.reservations.some(slot => !exact(slot, ["bookingId", "start", "end"]) || !hallId(slot.bookingId) || !Number.isFinite(slot.start) || !Number.isFinite(slot.end) || slot.start >= slot.end)) issue("day-index-shape", reference("hall/group/days", id));
  }
  const instant = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  for (const [id, data] of records("hallAvailability")) {
    try {hallDate(id);} catch {issue("invalid-index-date", reference("hallAvailability", id));}
    if (!exact(data, ["occupied"]) || !Array.isArray(data.occupied) || data.occupied.length > 300 || data.occupied.some(slot => !exact(slot, ["start", "end"]) || !instant(slot.start) || !instant(slot.end) || slot.start >= slot.end)) issue("public-privacy-shape", reference("hallAvailability", id));
  }
  const settings = records("siteSettings"), lock = records("hall").get("group");
  if (settings.has("hallHire") && typeof settings.get("hallHire")?.enabled !== "boolean") issue("canonical-rollout-shape", "siteSettings/hallHire");
  if (lock?.ready !== undefined && typeof lock.ready !== "boolean") issue("canonical-readiness-shape", "hall/group");
  for (const [id, key] of [["hallHirePublic", "enabled"], ["hallHireReadiness", "ready"]]) {
    const safe = settings.get(id);
    if (safe !== undefined && (!exact(safe, [key]) || typeof safe[key] !== "boolean")) issue("public-settings-shape", `siteSettings/${id}`);
  }
  if ((settings.get("hallHire")?.enabled === true) !== (settings.get("hallHirePublic")?.enabled === true)) issue("rollout-projection-mismatch", "siteSettings/hallHirePublic");
  if ((lock?.ready === true) !== (settings.get("hallHireReadiness")?.ready === true)) issue("readiness-projection-mismatch", "siteSettings/hallHireReadiness");
  return {schemaVersion: 1, scope: {from, through}, activationApproved: false, consistent: issues.length === 0,
    counts: Object.fromEntries(Object.keys(HALL_AUDIT_COLLECTIONS).map(name => [name, records(name).size])),
    inventory: inventory.sort((a, b) => a.path.localeCompare(b.path)), issues: issues.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code))};
}
