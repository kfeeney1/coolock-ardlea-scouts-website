import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserFacingError } from "./applicationErrors";
import { calendarDays, type CalendarEntry } from "./groupCalendar";
import { appointmentCalendarEntry, appointmentErrors, cleanAppointment, type AppointmentInput, type MaintenanceAppointment } from "./maintenanceAppointmentLogic";
export const appointmentRoot = "maintenance/group/appointments";
export const validAppointmentId = (id: string) => /^[a-zA-Z0-9-]{20,64}$/.test(id);
function mapAppointment(id: string, data: Record<string, unknown>): MaintenanceAppointment | null {
  const record = {id, ...data} as MaintenanceAppointment;
  return typeof record.title === "string" && typeof record.date === "string" && typeof record.location === "string" && typeof record.notes === "string" && typeof record.startTime === "string" && typeof record.endTime === "string" && typeof record.allDay === "boolean" && Number.isInteger(record.revision) && !Object.keys(appointmentErrors(record)).length ? record : null;
}
export async function saveMaintenanceAppointment(id: string, input: AppointmentInput, revision: number) {
  const uid = auth.currentUser?.uid;
  if (!uid || !validAppointmentId(id)) throw new UserFacingError("Sign in with a valid appointment reference.");
  const errors = appointmentErrors(input);
  if (Object.keys(errors).length) throw new UserFacingError(Object.values(errors)[0]!);
  const values = cleanAppointment(input), target = doc(db, appointmentRoot, id);
  await runTransaction(db, async tx => {
    const current = (await tx.get(target)).data();
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
  const days = calendarDays(month);
  return onSnapshot(query(collection(db, appointmentRoot), where("date", ">=", days[0]), where("date", "<=", days.at(-1)!)), {includeMetadataChanges: true}, snapshot => {
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) next(snapshot.docs.flatMap(item => {const record = mapAppointment(item.id, item.data()); return record ? [appointmentCalendarEntry(record)] : [];}));
  }, failed);
}
