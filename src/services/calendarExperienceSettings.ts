import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure } from "./applicationErrors";
export type CalendarExperienceVersion = "existing" | "redesigned";
export function calendarVersion(data?: Record<string, unknown>): CalendarExperienceVersion {
  return data?.version === "redesigned" ? "redesigned" : "existing";
}
const ref = doc(db, "siteSettings/calendarExperience");
export function watchCalendarExperience(next: (version: CalendarExperienceVersion) => void, failed: () => void) {
  return onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) next(calendarVersion(snapshot.data()));
  }, failed);
}
export async function saveCalendarExperience(version: CalendarExperienceVersion, expected: CalendarExperienceVersion) {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign in to change Calendar.", "auth/unauthenticated");
  if (!["existing", "redesigned"].includes(version)) throw new Error("Choose a Calendar option.");
  await runTransaction(db, async tx => {
    if (calendarVersion((await tx.get(ref)).data()) !== expected) throw new ServiceFailure("Calendar changed in another session. Reload settings and try again.", "firestore/aborted");
    tx.set(ref, {version, updatedBy: user.uid, updatedAt: serverTimestamp()});
  });
}
