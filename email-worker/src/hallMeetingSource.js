import { assertHallCouncil, hallFailure } from "./hallBookingModel.js";
import { saveSourceHallReservation } from "./hallSourceReservation.js";
import { isCanonicalDateOnly } from "../../src/services/weeklyMeetingProgrammeLogic.ts";
const groupRoles = ["Group Leader", "Deputy Group Leader", "Deputy-Group-Leader", "Deputy GroupLead", "DGL"];
const aliases = {Beaver: "Beavers", "Beaver Scout": "Beavers", "Beaver Scouts": "Beavers", Cub: "Cubs", "Cub Scout": "Cubs", "Cub Scouts": "Cubs", Scout: "Scouts", Venture: "Ventures", "Venture Scout": "Ventures", "Venture Scouts": "Ventures", Rover: "Rovers", "Rover Scout": "Rovers", "Rover Scouts": "Rovers"};
/** Matches weeklyMeetings' current section/group write scope; Council is checked separately. */
export function hallMeetingScope(profile, organisation, section) {
  return typeof section === "string" && (profile?.sections?.includes(section) || profile?.sections?.includes(aliases[section])
    || ["admin", "super-admin"].includes(profile?.role) || (organisation?.active === true && groupRoles.includes(organisation.scoutingRole)));
}
function validate(command) {
  const keys = command?.release === true ? ["id", "expectedRevision", "expectedDate", "release"] : ["id", "expectedRevision", "expectedDate", "date", "startTime", "endTime"];
  if (!command || typeof command !== "object" || Array.isArray(command) || Object.keys(command).some(key => !keys.includes(key))
    || typeof command.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(command.id) || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0 || command.expectedRevision > 1_000_000
    || !isCanonicalDateOnly(command.expectedDate) || (!command.release && (!isCanonicalDateOnly(command.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(command.startTime ?? "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(command.endTime ?? "")))) hallFailure(400, "hall/invalid", "Invalid meeting hall schedule.");
}
function rescheduledParent(parent, current, date, now) {
  // A missing/stale legacy projection must be reconciled, never guessed from private notes.
  if (!parent || Object.keys(parent).some(key => !["section", "meetingDate", "status", "location", "theme", "activities", "badgework", "updatedAt"].includes(key))
    || parent.section !== current.section || parent.meetingDate !== current.meetingDate || parent.status !== current.status || typeof parent.theme !== "string"
    || typeof parent.location !== "string" || !Array.isArray(parent.activities) || !Array.isArray(parent.badgework) || parent.activities.length > 30 || parent.badgework.length > 30) hallFailure(409, "hall/reconcile", "The parent programme needs reconciliation before changing the meeting date.");
  for (const item of [...parent.activities, ...parent.badgework]) {
    if (!item || typeof item !== "object" || Object.keys(item).some(key => !["name", "durationMinutes", "equipment"].includes(key))
      || typeof item.name !== "string" || !Number.isFinite(item.durationMinutes) || typeof item.equipment !== "string") hallFailure(409, "hall/reconcile", "The parent programme needs reconciliation before changing the meeting date.");
  }
  return {meetingDate: date, updatedAt: new Date(now)};
}
/** Schedule-only source adapter: never accepts browser programme/member/incident data. */
export async function saveHallMeetingSource(store, uid, command, now = Date.now()) {
  validate(command);
  await saveSourceHallReservation(store, uid, "meeting", command.id, async (tx, {path, current}) => {
    const [profile, organisation, rollout, lock] = await tx.read([`adminUsers/${uid}`, `organisationLeadership/${uid}`, "siteSettings/hallHire", "hall/group"]);
    assertHallCouncil(profile, organisation, now);
    if (!current || !hallMeetingScope(profile, organisation, current.section)) hallFailure(403, "hall/forbidden", "Current meeting write permission is required.");
    if ((current.hallRevision ?? 0) !== command.expectedRevision || current.meetingDate !== command.expectedDate) hallFailure(409, "hall/stale", "This meeting schedule changed. Reopen it before saving.");
    if (!["open", "closed"].includes(current.status)) hallFailure(409, "hall/reconcile", "This meeting needs reconciliation before reserving the hall.");
    if (!command.release && current.status !== "open") hallFailure(409, "hall/closed", "Reopen the meeting before reserving or moving hall time.");
    if (!command.release && current.hallResource !== "group-hall" && (rollout?.enabled !== true || lock?.ready !== true)) hallFailure(409, "hall/disabled", "Hall Hire is not enabled.");
    if (command.release && current.hallResource !== "group-hall") hallFailure(409, "hall/source-owned", "The meeting has no hall reservation to release.");
    const parentPath = `parentWeeklyMeetings/${command.id}`;
    let parentNext = null;
    if (!command.release && command.date !== current.meetingDate) parentNext = rescheduledParent((await tx.read([parentPath]))[0], current, command.date, now);
    const next = {hallRevision: command.expectedRevision + 1, updatedBy: uid, updatedAt: new Date(now),
      ...(!command.release ? {meetingDate: command.date, hallResource: "group-hall", hallStartTime: command.startTime, hallEndTime: command.endTime} : {})};
    const occupancy = command.release ? null : {resourceId: "group-hall", kind: "internal", state: "confirmed", interval: {date: command.date, startTime: command.startTime, endDate: command.date, endTime: command.endTime}};
    return {authorised: true, occupancy, persist: () => {tx.patch(path, next, command.release ? ["hallResource", "hallStartTime", "hallEndTime"] : []); if (parentNext) tx.patch(parentPath, parentNext);}};
  }, now);
  return {id: command.id, revision: command.expectedRevision + 1};
}
