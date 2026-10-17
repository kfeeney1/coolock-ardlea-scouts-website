import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure } from "./applicationErrors";

export type LeaderNavigationVersion = "existing" | "redesigned";
const ref = doc(db, "siteSettings", "leaderNavigation");
export function navigationVersion(data?: Record<string, unknown>): LeaderNavigationVersion {
  return data?.version === "redesigned" ? "redesigned" : "existing";
}
/** This document contains only the group-wide presentation choice and its audit metadata. */
export function watchLeaderNavigation(next: (version: LeaderNavigationVersion) => void, failed: () => void) {
  return onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    next(navigationVersion(snapshot.data()));
  }, failed);
}
export async function saveLeaderNavigation(version: LeaderNavigationVersion, expected: LeaderNavigationVersion) {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign in to change navigation.", "auth/unauthenticated");
  if (!["existing", "redesigned"].includes(version)) throw new Error("Choose a navigation version.");
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (navigationVersion(snapshot.data()) !== expected) {
      throw new ServiceFailure("Navigation changed in another session. Reload settings and try again.", "firestore/aborted");
    }
    transaction.set(ref, { version, updatedBy: user.uid, updatedAt: serverTimestamp() });
  });
}
