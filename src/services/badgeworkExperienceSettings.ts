import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure } from "./applicationErrors";
import { badgeworkVersion, type BadgeworkExperienceVersion } from "./badgeworkExperienceLogic.ts";

export type { BadgeworkExperienceVersion } from "./badgeworkExperienceLogic.ts";
const ref = doc(db, "siteSettings", "badgeworkExperience");

/** Only server-confirmed presentation configuration; never publish a pending local choice. */
export function watchBadgeworkExperience(next: (version: BadgeworkExperienceVersion) => void, failed: () => void) {
  return onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) next(badgeworkVersion(snapshot.data()));
  }, failed);
}

export async function saveBadgeworkExperience(version: BadgeworkExperienceVersion, expected: BadgeworkExperienceVersion) {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("Sign in to change badgework settings.", "auth/unauthenticated");
  if (!["existing", "redesigned"].includes(version)) throw new Error("Choose a badgework experience.");
  await runTransaction(db, async transaction => {
    if (badgeworkVersion((await transaction.get(ref)).data()) !== expected) {
      throw new ServiceFailure("Badgework settings changed in another session. Reload settings and try again.", "firestore/aborted");
    }
    transaction.set(ref, { version, updatedBy: user.uid, updatedAt: serverTimestamp() });
  });
}
