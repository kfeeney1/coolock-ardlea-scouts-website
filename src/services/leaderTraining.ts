import { collection, doc, getDocs, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserFacingError } from "./applicationErrors.ts";
import { trainingCategories, trainingDatesError, type LeaderTrainingRecord, type TrainingCategory, type TrainingDates } from "./leaderTrainingLogic.ts";

export async function loadLeaderTraining(leaderUid: string): Promise<Partial<Record<TrainingCategory, LeaderTrainingRecord>>> {
  const snapshot = await getDocs(collection(db, "adminUsers", leaderUid, "training"));
  const records: Partial<Record<TrainingCategory, LeaderTrainingRecord>> = {};
  for (const item of snapshot.docs) {
    if (trainingCategories.includes(item.id as TrainingCategory)) records[item.id as TrainingCategory] = item.data() as LeaderTrainingRecord;
  }
  return records;
}

/** A category has exactly one canonical path. Renewal replaces dates, never adds a duplicate. */
export async function saveLeaderTraining(leaderUid: string, category: TrainingCategory, dates: TrainingDates, expectedRevision: number) {
  const user = auth.currentUser;
  if (!user) throw new UserFacingError("Sign in to maintain training records.");
  if (!trainingCategories.includes(category)) throw new UserFacingError("Choose a training category.");
  const error = trainingDatesError(dates);
  if (error) throw new UserFacingError(error);
  // Firestore can keep retrying an offline transaction before surfacing an error.
  // Reject a known-offline save before starting it, so the editor stays recoverable.
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new UserFacingError("Unable to save training dates while offline. Reconnect and try again; your changes have been retained.");
  const ref = doc(db, "adminUsers", leaderUid, "training", category);
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if ((snapshot.data()?.revision ?? 0) !== expectedRevision) throw new UserFacingError("This training record changed. Reload before saving.");
    tx.set(ref, { completedDate: dates.completedDate, expiryDate: dates.expiryDate, revision: expectedRevision + 1, updatedBy: user.uid, updatedAt: serverTimestamp() });
  });
}
