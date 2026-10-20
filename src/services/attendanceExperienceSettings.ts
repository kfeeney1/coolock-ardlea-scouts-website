import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure } from "./applicationErrors";

export type AttendanceExperienceVersion = "existing" | "redesigned";
const ref = doc(db, "siteSettings", "attendanceExperience");
export function attendanceVersion(data?: Record<string, unknown>): AttendanceExperienceVersion {
  return data?.version === "redesigned" ? "redesigned" : "existing";
}
/** This document contains only the group-wide presentation choice and its audit metadata. */
export function watchAttendanceExperience(next: (version: AttendanceExperienceVersion) => void, failed: () => void) {
  return onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    next(attendanceVersion(snapshot.data()));
  }, failed);
}
export async function saveAttendanceExperience(version: AttendanceExperienceVersion, expected: AttendanceExperienceVersion) {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign in to change attendance experience.", "auth/unauthenticated");
  if (!["existing", "redesigned"].includes(version)) throw new Error("Choose an attendance experience version.");
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (attendanceVersion(snapshot.data()) !== expected) {
      throw new ServiceFailure("Attendance experience changed in another session. Reload settings and try again.", "firestore/aborted");
    }
    transaction.set(ref, { version, updatedBy: user.uid, updatedAt: serverTimestamp() });
  });
}
