import { collection, doc, getDoc, getDocs, runTransaction, increment, serverTimestamp, Timestamp, type Firestore, type DocumentReference, type DocumentData, type SetOptions } from "firebase/firestore";
import { normalizeScoutingAppointmentAssignments } from "../security/scoutingAppointments.ts";
import { UserFacingError } from "./applicationErrors.ts";
import { maintenanceLeaderProjection, type MaintenanceLeader } from "./maintenanceAssignmentPolicy.ts";
export const maintenanceDirectoryPath = "maintenance/group/config/leaders";
export const maintenanceEpochPath = maintenanceDirectoryPath;
export const maintenanceLeadersPath = "maintenance/group/leaders";
export type MaintenanceDirectory = {ready: boolean; groupLeaderUids: string[]; generation: number; validUntil: Timestamp};
export function invalidateMaintenanceDirectory(writer: {set: (reference: DocumentReference, data: DocumentData, options: SetOptions) => unknown}, db: Firestore, uid: string) {
  writer.set(doc(db, maintenanceEpochPath), {generation: increment(1), ready: false, updatedAt: serverTimestamp(), updatedBy: uid}, {merge: true});
}
export function requireFreshMaintenanceDirectory(directory: MaintenanceDirectory | undefined) {
  if (!directory?.ready || directory.validUntil.toMillis() <= Date.now()) throw new UserFacingError("The leader directory needs refreshing by a Superuser in Maintenance settings. Your task details are retained.");
  return directory;
}
export async function loadMaintenanceLeaders(db: Firestore) {
  const directory = requireFreshMaintenanceDirectory((await getDoc(doc(db, maintenanceDirectoryPath))).data() as MaintenanceDirectory | undefined);
  const entries = await getDocs(collection(db, maintenanceLeadersPath));
  return entries.docs.filter(item => item.data().generation === directory.generation).map(item => item.data() as MaintenanceLeader).sort((a, b) => a.displayName.localeCompare(b.displayName));
}
/** Only authorised administrators publish the minimal snapshot. Canonical source
 * writes invalidate its generation atomically; effective-date boundaries expire it. */
export async function rebuildMaintenanceDirectory(db: Firestore, uid: string) {
  const epochRef = doc(db, maintenanceEpochPath);
  await runTransaction(db, async tx => { await tx.get(epochRef); invalidateMaintenanceDirectory(tx, db, uid); });
  const before = (await getDoc(epochRef)).data()!.generation;
  const [accounts, organisations] = await Promise.all([getDocs(collection(db, "adminUsers")), getDocs(collection(db, "organisationLeadership"))]);
  const access = new Map(accounts.docs.map(item => [item.id, item.data()]));
  const leaders: Record<string, MaintenanceLeader & {eligibleIndex: number; groupLeaderIndex: number}> = {};
  const today = new Date().toISOString().slice(0, 10);
  let validUntil = Date.parse("9999-01-01T00:00:00Z");
  for (const record of organisations.docs) {
    const data = record.data();
    const candidate = maintenanceLeaderProjection(record.id, access.get(record.id) || {}, data);
    if (candidate) leaders[record.id] = candidate;
    for (const appointment of normalizeScoutingAppointmentAssignments(data.appointments, data.scoutingRole, data.organisationSection)) {
      if (!appointment.active) continue;
      if (appointment.startDate && appointment.startDate > today) validUntil = Math.min(validUntil, Date.parse(`${appointment.startDate}T00:00:00Z`));
      if (appointment.endDate && appointment.endDate >= today) validUntil = Math.min(validUntil, Date.parse(`${appointment.endDate}T00:00:00Z`) + 86400000);
    }
  }
  if (!Number.isFinite(validUntil)) throw new UserFacingError("A leader appointment has an invalid effective date. Correct it before refreshing the directory.");
  for (const candidate of Object.values(leaders)) {
    // Each projection write is independently checked against private canonical
    // sources by Rules, without granting members access to those sources.
    await runTransaction(db, async tx => {
      if ((await tx.get(epochRef)).data()?.generation !== before) throw new UserFacingError("Leader appointments changed during refresh. Refresh the directory again.");
      tx.set(doc(db, maintenanceLeadersPath, candidate.uid), {...candidate, generation: before});
    });
  }
  await runTransaction(db, async tx => {
    if ((await tx.get(epochRef)).data()?.generation !== before) throw new UserFacingError("Leader appointments changed during refresh. Refresh the directory again.");
    tx.set(epochRef, {ready: true, groupLeaderUids: Object.values(leaders).filter(item => item.groupLeader).map(item => item.uid), generation: before, validUntil: Timestamp.fromMillis(validUntil), updatedAt: serverTimestamp(), updatedBy: uid});
  });
  return Object.keys(leaders).length;
}
