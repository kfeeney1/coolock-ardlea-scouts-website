import {assertHallCouncil, hallFailure} from "./hallBookingModel.js";
import {hallMeetingScope} from "./hallMeetingSource.js";
import {saveSourceHallReservation} from "./hallSourceReservation.js";
import {isCanonicalDateOnly} from "../../src/services/weeklyMeetingProgrammeLogic.ts";

function validate(command) {
  const keys = ["id", "expectedRevision", "expectedStartDate", "expectedEndDate", ...(command?.release === true ? ["release"] : ["interval"])];
  if (!command || typeof command !== "object" || Array.isArray(command) || Object.keys(command).some(key => !keys.includes(key))
    || typeof command.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(command.id)
    || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0 || command.expectedRevision > 1_000_000
    || !isCanonicalDateOnly(command.expectedStartDate) || !isCanonicalDateOnly(command.expectedEndDate)) hallFailure(400, "hall/invalid", "Invalid event hall schedule.");
  if (!command.release && (!isCanonicalDateOnly(command.interval?.date) || !isCanonicalDateOnly(command.interval?.endDate)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(command.interval?.startTime ?? "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(command.interval?.endTime ?? ""))) hallFailure(400, "hall/invalid", "Invalid event hall interval.");
}

/** Hall use is an explicit interval inside the event; event dates and audience stay source-owned. */
export async function saveHallEventSource(store, uid, command, now = Date.now()) {
  validate(command);
  await saveSourceHallReservation(store, uid, "event", command.id, async (tx, {path, current}) => {
    const [profile, organisation, rollout, lock] = await tx.read([`adminUsers/${uid}`, `organisationLeadership/${uid}`, "siteSettings/hallHire", "hall/group"]);
    assertHallCouncil(profile, organisation, now);
    // Match hasSection, the canonical direct event write rule. Group Council alone grants no programme scope.
    if (!current || !hallMeetingScope(profile, {}, current.section)) hallFailure(403, "hall/forbidden", "Current event write permission is required.");
    if ((current.hallRevision ?? 0) !== command.expectedRevision || current.startDate !== command.expectedStartDate || current.endDate !== command.expectedEndDate) hallFailure(409, "hall/stale", "This event schedule changed. Reopen it before saving.");
    if (!["draft", "open", "closed", "completed"].includes(current.status)) hallFailure(409, "hall/reconcile", "This event needs reconciliation.");
    if (!command.release && !["open", "closed"].includes(current.status)) hallFailure(409, "hall/closed", "Open the event before reserving hall time.");
    if (!command.release && current.hallResource !== "group-hall" && (rollout?.enabled !== true || lock?.ready !== true)) hallFailure(409, "hall/disabled", "Hall Hire is not enabled.");
    if (command.release && current.hallResource !== "group-hall") hallFailure(409, "hall/source-owned", "The event has no hall reservation to release.");
    if (!command.release && (!command.interval || command.interval.date < current.startDate || command.interval.endDate > current.endDate)) hallFailure(400, "hall/invalid", "Hall use must be within the event dates.");
    const next = {hallRevision: command.expectedRevision + 1, updatedBy: uid, updatedAt: new Date(now),
      ...(!command.release ? {hallResource: "group-hall", hallInterval: command.interval} : {})};
    const occupancy = command.release ? null : {resourceId: "group-hall", kind: "internal", state: "confirmed", interval: command.interval};
    // Shared domain validation rejects extra interval keys, invalid dates, DST ambiguity and unbounded spans before persist.
    return {authorised: true, occupancy, persist: () => tx.patch(path, next, command.release ? ["hallResource", "hallInterval"] : [])};
  }, now);
  return {id: command.id, revision: command.expectedRevision + 1};
}
