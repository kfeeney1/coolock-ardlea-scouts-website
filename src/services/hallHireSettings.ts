import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure } from "./applicationErrors";
import { hallHireEnabled } from "./hallHireRolloutPolicy.ts";
const settingRef = doc(db, "siteSettings/hallHire");
const publicRef = doc(db, "siteSettings/hallHirePublic");
const readinessRef = doc(db, "siteSettings/hallHireReadiness");

function watchPair(privateSetting: boolean, next: (value: {enabled: boolean; ready: boolean}) => void, failed: () => void) {
  let setting: Record<string, unknown> | undefined, readiness: Record<string, unknown> | undefined, seenSetting = false, seenReady = false, active = true, healthy = true;
  const emit = () => {if (active && healthy && seenSetting && seenReady) next({enabled: setting?.enabled === true, ready: readiness?.ready === true});};
  const error = () => {if (active && healthy) {healthy = false; next({enabled: false, ready: false}); failed();}};
  const stopSetting = onSnapshot(privateSetting ? settingRef : publicRef, {includeMetadataChanges: true}, snapshot => {
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {setting = snapshot.data(); seenSetting = true; emit();}
  }, error);
  const stopReady = onSnapshot(readinessRef, {includeMetadataChanges: true}, snapshot => {
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {readiness = snapshot.data(); seenReady = true; emit();}
  }, error);
  return () => {active = false; stopSetting(); stopReady();};
}
/** Public consumers read only the two safe boolean projections; unavailable settings fail closed. */
export function watchHallHire(next: (enabled: boolean) => void, failed: () => void) {
  next(false);
  return watchPair(false, value => next(hallHireEnabled(value, value)), failed);
}
export function watchHallHireAdministration(next: (value: {enabled: boolean; ready: boolean}) => void, failed: () => void) {
  return watchPair(true, next, failed);
}
export async function saveHallHire(enabled: boolean, expected: boolean) {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign in to change Hall Hire.", "auth/unauthenticated");
  if (typeof enabled !== "boolean" || typeof expected !== "boolean") throw new Error("Choose a Hall Hire option.");
  await runTransaction(db, async tx => {
    const current = (await tx.get(settingRef)).data(), readiness = (await tx.get(readinessRef)).data();
    if ((current?.enabled === true) !== expected) throw new ServiceFailure("Hall Hire changed in another session. Reload settings before saving.", "firestore/aborted");
    if (enabled && readiness?.ready !== true) throw new ServiceFailure("Hall Hire is not ready to enable.", "firestore/failed-precondition");
    tx.set(settingRef, {enabled, updatedBy: user.uid, updatedAt: serverTimestamp()});
    tx.set(publicRef, {enabled});
  });
}
