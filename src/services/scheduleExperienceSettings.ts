import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure } from "./applicationErrors";

export type ScheduleExperienceVersion = "existing" | "redesigned";
const ref = doc(db, "siteSettings", "scheduleExperience");
export function scheduleVersion(data?: Record<string, unknown>): ScheduleExperienceVersion {
  return data?.version === "redesigned" ? "redesigned" : "existing";
}
/** This document contains only the group-wide presentation choice and its audit metadata. */
export function watchScheduleExperience(next: (version: ScheduleExperienceVersion) => void, failed: () => void) {
  return onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    next(scheduleVersion(snapshot.data()));
  }, failed);
}
export async function saveScheduleExperience(version: ScheduleExperienceVersion, expected: ScheduleExperienceVersion) {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign in to change schedule experience.", "auth/unauthenticated");
  if (!["existing", "redesigned"].includes(version)) throw new Error("Choose a schedule experience version.");
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (scheduleVersion(snapshot.data()) !== expected) {
      throw new ServiceFailure("Schedule experience changed in another session. Reload settings and try again.", "firestore/aborted");
    }
    transaction.set(ref, { version, updatedBy: user.uid, updatedAt: serverTimestamp() });
  });
}
