import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure } from "./applicationErrors";
export type MeetingRecordsExperienceVersion = "existing" | "redesigned";
export function meetingRecordsVersion(data?: Record<string, unknown>): MeetingRecordsExperienceVersion {
  return data?.version === "redesigned" ? "redesigned" : "existing";
}
const ref = doc(db, "siteSettings/meetingRecordsExperience");
export function watchMeetingRecordsExperience(next: (version: MeetingRecordsExperienceVersion) => void, failed: () => void) {
  return onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) next(meetingRecordsVersion(snapshot.data()));
  }, failed);
}
export async function saveMeetingRecordsExperience(version: MeetingRecordsExperienceVersion, expected: MeetingRecordsExperienceVersion) {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign in to change Meeting Records layout.", "auth/unauthenticated");
  if (!["existing", "redesigned"].includes(version)) throw new Error("Choose a Meeting Records layout option.");
  await runTransaction(db, async tx => {
    if (meetingRecordsVersion((await tx.get(ref)).data()) !== expected) throw new ServiceFailure("Meeting Records layout changed in another session. Reload settings and try again.", "firestore/aborted");
    tx.set(ref, {version, updatedBy: user.uid, updatedAt: serverTimestamp()});
  });
}
