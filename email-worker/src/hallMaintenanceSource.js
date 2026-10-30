import { assertHallCouncil, hallFailure } from "./hallBookingModel.js";
import { saveSourceHallReservation } from "./hallSourceReservation.js";
import { appointmentErrors, cleanAppointment } from "../../src/services/maintenanceAppointmentLogic.ts";
import { addHallDays } from "../../src/services/hallBookingTime.ts";
const validId = id => typeof id === "string" && /^(?:[a-zA-Z0-9-]{20,64}|task-[a-zA-Z0-9-]{20,64})$/.test(id);
const plain = value => value && typeof value === "object" && !Array.isArray(value);
function commandValues(command, cancel) {
  if (!plain(command) || Object.keys(command).some(key => !(cancel ? ["id", "expectedRevision"] : ["id", "expectedRevision", "input", "taskId"]).includes(key))
    || !validId(command.id) || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0 || command.expectedRevision > 1_000_000) hallFailure(400, "hall/invalid", "Invalid appointment command.");
  if (cancel) return null;
  const input = command.input, taskId = command.taskId ?? "";
  if (typeof taskId !== "string" || (taskId && (!/^[A-Za-z0-9-]{20,64}$/.test(taskId) || command.id !== `task-${taskId}`)) || (!taskId && command.id.startsWith("task-"))) hallFailure(400, "hall/invalid", "Invalid task appointment reference.");
  if (!plain(input) || Object.keys(input).some(key => !["title", "date", "allDay", "startTime", "endTime", "location", "notes", "hallResource"].includes(key))
    || ["title", "date", "startTime", "endTime", "location", "notes"].some(key => typeof input[key] !== "string") || typeof input.allDay !== "boolean"
    || (input.hallResource !== undefined && !["", "group-hall"].includes(input.hallResource))) hallFailure(400, "hall/invalid", "Invalid appointment fields.");
  if (Object.keys(appointmentErrors({...input, title: taskId ? "Linked task" : input.title})).length) hallFailure(400, "hall/invalid", "Check appointment dates, times and details.");
  return {...cleanAppointment(input), ...(taskId ? {taskId, title: ""} : {})};
}

/** Council authority supplements, never replaces, the canonical appointment access policy. */
export async function saveHallMaintenanceSource(store, uid, command, {cancel = false, now = Date.now()} = {}) {
  const values = commandValues(command, cancel);
  await saveSourceHallReservation(store, uid, "maintenance", command.id, async (tx, {path, current}) => {
    const [profile, organisation, maintenance, calendar, membership, rollout, lock] = await tx.read([
      `adminUsers/${uid}`, `organisationLeadership/${uid}`, "siteSettings/maintenanceExperience", "siteSettings/calendarExperience",
      `maintenance/group/access/${uid}`, "siteSettings/hallHire", "hall/group"
    ]);
    assertHallCouncil(profile, organisation, now);
    if (maintenance?.version !== "redesigned" || maintenance?.sdkRevision !== 1 || calendar?.version !== "redesigned"
      || membership?.kind !== "leader" || membership.sourceId !== uid) hallFailure(403, "hall/forbidden", "Current Calendar and Maintenance access is required.");
    if ((current?.revision ?? 0) !== command.expectedRevision) hallFailure(409, "hall/stale", "This appointment changed. Reopen it before saving.");
    if (cancel && current?.hallResource !== "group-hall") hallFailure(409, "hall/source-owned", "A hall appointment is required.");
    if (!cancel && current && (current.taskId ?? "") !== (values.taskId ?? "")) hallFailure(409, "hall/source-owned", "This appointment belongs to a different source task.");
    if (values?.taskId && !(await tx.read([`maintenance/group/tasks/${values.taskId}`]))[0]) hallFailure(409, "hall/source-owned", "The source task is unavailable.");
    if (!cancel && values.hallResource === "group-hall" && current?.hallResource !== "group-hall" && (rollout?.enabled !== true || lock?.ready !== true)) hallFailure(409, "hall/disabled", "Hall Hire is not enabled.");
    // Only the hall path is migrated: ordinary non-hall scheduling retains its SDK path.
    if (!cancel && current?.hallResource !== "group-hall" && values.hallResource !== "group-hall") hallFailure(400, "hall/invalid", "Use ordinary appointment scheduling for non-hall records.");
    const next = cancel ? {...current, cancelled: true} : values;
    const occupancy = next.hallResource === "group-hall" && !next.cancelled ? {resourceId: "group-hall", kind: "blocked", state: "confirmed",
      interval: {date: next.date, startTime: next.allDay ? "00:00" : next.startTime, endDate: next.allDay ? addHallDays(next.date, 1) : next.date, endTime: next.allDay ? "00:00" : next.endTime}} : null;
    const timestamp = new Date(now), revision = command.expectedRevision + 1;
    return {authorised: true, occupancy, persist: () => tx.set(path, {...next, revision,
      createdBy: current?.createdBy ?? uid, createdAt: current?.createdAt ? new Date(current.createdAt) : timestamp, updatedBy: uid, updatedAt: timestamp})};
  }, now);
  return {id: command.id, revision: command.expectedRevision + 1};
}
