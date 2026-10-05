import { collection, getDocs, limit, query, where, type Timestamp } from "firebase/firestore";

import { auth, db } from "../firebase";
import { leaderMedicalStateFromPlainRecords } from "./leaderMedicalLifecycleCore";
export { daysBetweenLocalDates, leaderMedicalNeedsDashboardAction, leaderMedicalValidityEnd, LEADER_MEDICAL_REMINDER_DAYS } from "./leaderMedicalLifecycleCore";
export type { LeaderMedicalState, MedicalValidityStatus } from "./leaderMedicalLifecycleCore";
import type { LeaderMedicalState } from "./leaderMedicalLifecycleCore";

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timestampDate(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return localDate((value as Timestamp).toDate());
  }
  return "";
}

export async function loadOwnLeaderMedicalState(): Promise<LeaderMedicalState> {
  const user = auth.currentUser;
  if (!user) return { status: "missing", formId: null, validityFrom: "", validityTo: "", daysUntilExpiry: null, data: null };
  const snapshot = await getDocs(query(
    collection(db, "consentApplications"),
    where("formType", "==", "scouter-es3-medical-advice"),
    where("submittedByUid", "==", user.uid),
    limit(20)
  ));
  return leaderMedicalStateFromPlainRecords(snapshot.docs.map((item) => ({
    id: item.id,
    data: item.data(),
    submittedDate: timestampDate(item.data().submittedAt)
  })), localDate(new Date()));
}
