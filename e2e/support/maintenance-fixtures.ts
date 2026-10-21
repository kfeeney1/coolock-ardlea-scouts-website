import { Timestamp } from "firebase-admin/firestore";
import { maintenanceLeaderProjection } from "../../src/services/maintenanceAssignmentPolicy";
import { scheduleFixtureDb } from "./schedule-fixtures";
/** Demo-only guarded database; snapshot all shared config and restore on exit. */
export async function enableMaintenanceFixture() {
  const db = scheduleFixtureDb();
  const refs = ["siteSettings/maintenanceExperience", "maintenance/group/config/leaders"].map(path => db.doc(path));
  let previous = await Promise.all(refs.map(ref => ref.get()));
  const [accounts, organisations] = await Promise.all([db.collection("adminUsers").get(), db.collection("organisationLeadership").get()]);
  const profiles = new Map(accounts.docs.map(item => [item.id, item.data()]));
  const candidates = organisations.docs.map(item => maintenanceLeaderProjection(item.id, profiles.get(item.id) || {}, item.data())).filter(item => item !== null);
  const candidateRefs = candidates.map(item => db.doc(`maintenance/group/leaders/${item.uid}`));
  refs.push(...candidateRefs); previous = [...previous, ...await Promise.all(candidateRefs.map(ref => ref.get()))];
  const generation = (previous[1].data()?.generation || 0) + 1;
  const batch = db.batch();
  batch.set(refs[0], {version: "redesigned"});
  candidates.forEach((item, index) => batch.set(candidateRefs[index], {...item, generation}));
  batch.set(refs[1], {ready: true, generation, groupLeaderUids: candidates.filter(item => item.groupLeader).map(item => item.uid), validUntil: Timestamp.fromMillis(Date.now() + 3600000)});
  await batch.commit();
  return async () => {const restore = db.batch(); previous.forEach((snap, index) => {if (snap.exists) restore.set(refs[index], snap.data()!); else restore.delete(refs[index]);}); await restore.commit();};
}
