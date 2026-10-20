import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure } from "./applicationErrors";
import { maintenanceAvailable, requireMaintenanceRuntime } from "./maintenanceRuntime";

export type MaintenanceExperienceVersion = "existing" | "redesigned";
const ref = doc(db, "siteSettings", "maintenanceExperience");
export function maintenanceVersion(data?: Record<string, unknown>): MaintenanceExperienceVersion {
  return data?.version === "redesigned" ? "redesigned" : "existing";
}
/** This document contains only the group-wide presentation choice and its audit metadata. */
export function watchMaintenanceExperience(next: (version: MaintenanceExperienceVersion) => void, failed: () => void) {
  if (!maintenanceAvailable) { next("existing"); return () => {}; }
  return onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    next(maintenanceVersion(snapshot.data()));
  }, failed);
}
export async function saveMaintenanceExperience(version: MaintenanceExperienceVersion, expected: MaintenanceExperienceVersion) {
  requireMaintenanceRuntime();
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign in to change Maintenance.", "auth/unauthenticated");
  if (!["existing", "redesigned"].includes(version)) throw new Error("Choose an Maintenance version.");
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (maintenanceVersion(snapshot.data()) !== expected) {
      throw new ServiceFailure("Maintenance changed in another session. Reload settings and try again.", "firestore/aborted");
    }
    transaction.set(ref, { version, updatedBy: user.uid, updatedAt: serverTimestamp() });
  });
}
