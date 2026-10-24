import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure } from "./applicationErrors";
export type LeaderTrainingExperienceVersion = "existing" | "redesigned";
export function leaderTrainingVersion(data?: Record<string, unknown>): LeaderTrainingExperienceVersion {
  return data?.version === "redesigned" ? "redesigned" : "existing";
}
const ref = doc(db, "siteSettings/leaderTrainingExperience");
export function watchLeaderTrainingExperience(next: (version: LeaderTrainingExperienceVersion) => void, failed: () => void) {
  return onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) next(leaderTrainingVersion(snapshot.data()));
  }, failed);
}
export async function saveLeaderTrainingExperience(version: LeaderTrainingExperienceVersion, expected: LeaderTrainingExperienceVersion) {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign in to change leader training settings.", "auth/unauthenticated");
  if (!["existing", "redesigned"].includes(version)) throw new Error("Choose a leader training option.");
  await runTransaction(db, async tx => {
    if (leaderTrainingVersion((await tx.get(ref)).data()) !== expected) throw new ServiceFailure("Leader training settings changed in another session. Reload settings and try again.", "firestore/aborted");
    tx.set(ref, {version, updatedBy: user.uid, updatedAt: serverTimestamp()});
  });
}
