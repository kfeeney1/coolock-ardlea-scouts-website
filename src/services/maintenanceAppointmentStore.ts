import { requestHallBooking } from "./hallBookingClient";
import { taskAppointmentId, taskCalendarEntry, watchMaintenanceTask } from "./maintenanceTaskCalendar";
import type { MaintenanceTask } from "./maintenanceTaskStore";
import { collection, doc, getDocFromServer, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserFacingError } from "./applicationErrors";
import { calendarDays, type CalendarEntry } from "./groupCalendar";
import { appointmentCalendarEntry, appointmentErrors, cleanAppointment, type AppointmentInput, type MaintenanceAppointment } from "./maintenanceAppointmentLogic";
export const appointmentRoot = "maintenance/group/appointments";
export const validAppointmentId = (id: string) => /^(?:[a-zA-Z0-9-]{20,64}|task-[a-zA-Z0-9-]{20,64})$/.test(id);
function mapAppointment(id: string, data: Record<string, unknown>): MaintenanceAppointment | null {
  const record = {id, ...data} as MaintenanceAppointment;
  return typeof record.title === "string" && typeof record.date === "string" && typeof record.location === "string" && typeof record.notes === "string" && typeof record.startTime === "string" && typeof record.endTime === "string" && typeof record.allDay === "boolean" && Number.isInteger(record.revision) && !Object.keys(appointmentErrors({...record, title: record.taskId ? "Linked task" : record.title})).length && (!record.taskId || (typeof record.taskId === "string" && /^[a-zA-Z0-9-]{20,64}$/.test(record.taskId) && id === taskAppointmentId(record.taskId) && record.title === "")) ? record : null;
}
export async function saveMaintenanceAppointment(id: string, input: AppointmentInput, revision: number, taskId = "") {
  const uid = auth.currentUser?.uid;
  if (!uid || !validAppointmentId(id)) throw new UserFacingError("Sign in with a valid appointment reference.");
  if (taskId && (!/^[a-zA-Z0-9-]{20,64}$/.test(taskId) || id !== taskAppointmentId(taskId))) throw new UserFacingError("Invalid source task reference.");
  const errors = appointmentErrors({...input, title: taskId ? "Linked task" : input.title});
  if (Object.keys(errors).length) throw new UserFacingError(Object.values(errors)[0]!);
  const target = doc(db, appointmentRoot, id);
  const hallWrite = input.hallResource === "group-hall" || (input.hallResource === "" && (await getDocFromServer(target)).data()?.hallResource === "group-hall");
  if (hallWrite) {
    const result = await requestHallBooking<{id: string; revision: number}>({action: "maintenance-save", command: {id, input, expectedRevision: revision, taskId}});
    if (result.id !== id || result.revision !== revision + 1) throw new UserFacingError("Appointment save was not confirmed. Reopen it before trying again.");
    return;
  }
  const values = {...cleanAppointment(input), ...(taskId ? {taskId, title: ""} : {})};
  await runTransaction(db, async tx => {
    const current = (await tx.get(target)).data();
    if (taskId && !(await tx.get(doc(db, "maintenance/group/tasks", taskId))).exists()) throw new UserFacingError("The source task is unavailable.");
    if (current && (current.taskId || "") !== taskId) throw new UserFacingError("This appointment belongs to a different source.");
    if (current?.hallResource || current?.cancelled) throw new UserFacingError("This appointment now uses the hall. Reopen it before saving.");
    const same = current && Object.entries(values).every(([key, value]) => current[key] === value);
    if (!revision) {
      if (current) {if (current.createdBy === uid && same) return; throw new UserFacingError("This appointment reference is already in use.");}
      tx.set(target, {...values, revision: 1, createdBy: uid, createdAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp()});
    } else {
      if (!current) throw new UserFacingError("This appointment no longer exists.");
      if (current.revision !== revision) {if (current.updatedBy === uid && same) return; throw new UserFacingError("This appointment changed in another session. Reopen it before saving; your edits are retained here.");}
      tx.update(target, {...values, revision: revision + 1, updatedBy: uid, updatedAt: serverTimestamp()});
    }
  });
}
export function watchMaintenanceAppointment(id: string, next: (record: MaintenanceAppointment | null) => void, failed: () => void) {
  return onSnapshot(doc(db, appointmentRoot, id), {includeMetadataChanges: true}, snapshot => {
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) next(snapshot.exists() ? mapAppointment(id, snapshot.data()) : null);
  }, failed);
}
export function watchMaintenanceAppointments(month: string, next: (entries: CalendarEntry[]) => void, failed: () => void) {
  const days = calendarDays(month); let active = true; let records: MaintenanceAppointment[] = [];
  const tasks = new Map<string, {loaded: boolean; task: MaintenanceTask | null; stop: () => void}>();
  const emit = () => {if (active && [...tasks.values()].every(item => item.loaded)) next(records.map(record => record.taskId ? taskCalendarEntry(record, tasks.get(record.taskId)!.task) : appointmentCalendarEntry(record)));};
  const stop = onSnapshot(query(collection(db, appointmentRoot), where("date", ">=", days[0]), where("date", "<=", days.at(-1)!)), {includeMetadataChanges: true}, snapshot => {
    if (!active || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    records = snapshot.docs.flatMap(item => {const record = mapAppointment(item.id, item.data()); return record && !record.cancelled ? [record] : [];});
    const ids = new Set(records.flatMap(record => record.taskId ? [record.taskId] : []));
    for (const [id, item] of tasks) if (!ids.has(id)) {item.stop(); tasks.delete(id);}
    for (const id of ids) if (!tasks.has(id)) {
      const item = {loaded: false, task: null as MaintenanceTask | null, stop: () => {}}; tasks.set(id, item);
      item.stop = watchMaintenanceTask(id, task => {if (active && tasks.get(id) === item) {item.task = task; item.loaded = true; emit();}}, failed);
    }
    emit();
  }, failed);
  return () => {active = false; stop(); tasks.forEach(item => item.stop());};
}

export async function cancelHallMaintenanceAppointment(id: string, expectedRevision: number) {
  const result = await requestHallBooking<{id: string; revision: number}>({action: "maintenance-cancel", command: {id, expectedRevision}});
  if (result.id !== id || result.revision !== expectedRevision + 1) throw new UserFacingError("Cancellation was not confirmed. Reopen the appointment before trying again.");
}
