import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure } from "./applicationErrors";

export type MeetingExperienceVersion = "existing" | "redesigned";
const ref = doc(db, "siteSettings", "meetingExperience");
export function meetingVersion(data?: Record<string, unknown>): MeetingExperienceVersion {
  return data?.version === "redesigned" ? "redesigned" : "existing";
}
/** This document contains only the group-wide presentation choice and its audit metadata. */
export function watchMeetingExperience(next: (version: MeetingExperienceVersion) => void, failed: () => void) {
  return onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    next(meetingVersion(snapshot.data()));
  }, failed);
}
export async function saveMeetingExperience(version: MeetingExperienceVersion, expected: MeetingExperienceVersion) {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign in to change meeting experience.", "auth/unauthenticated");
  if (!["existing", "redesigned"].includes(version)) throw new Error("Choose a meeting experience version.");
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (meetingVersion(snapshot.data()) !== expected) {
      throw new ServiceFailure("Meeting experience changed in another session. Reload settings and try again.", "firestore/aborted");
    }
    transaction.set(ref, { version, updatedBy: user.uid, updatedAt: serverTimestamp() });
  });
}
