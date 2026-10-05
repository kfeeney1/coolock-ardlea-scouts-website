import { collection, getDocs, limit, query, where, type DocumentData, type Timestamp } from "firebase/firestore";

import { auth, db } from "../firebase";

export type MedicalValidityStatus = "missing" | "incomplete" | "current" | "approaching-expiry" | "lapsed";

export type LeaderMedicalState = {
  status: MedicalValidityStatus;
  formId: string | null;
  validityFrom: string;
  validityTo: string;
  daysUntilExpiry: number | null;
  data: Record<string, unknown> | null;
};

export const LEADER_MEDICAL_REMINDER_DAYS = 45;

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function leaderMedicalValidityEnd(completedOn: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(completedOn);
  if (!match) throw new Error("A valid local completion date is required.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  // July/August completion is treated as preparation for the coming Scout year,
  // avoiding a late-August form expiring days after it is signed.
  const expiryYear = month >= 7 ? year + 1 : year;
  return `${expiryYear}-08-31`;
}

export function daysBetweenLocalDates(from: string, to: string): number {
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

function timestampDate(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return localDate((value as Timestamp).toDate());
  }
  return "";
}

export function leaderMedicalStateFromRecords(records: Array<{ id: string; data: DocumentData }>, today = localDate(new Date())): LeaderMedicalState {
  if (!records.length) return { status: "missing", formId: null, validityFrom: "", validityTo: "", daysUntilExpiry: null, data: null };
  const sorted = [...records].sort((a, b) => {
    const left = String(a.data.validityFrom || timestampDate(a.data.submittedAt));
    const right = String(b.data.validityFrom || timestampDate(b.data.submittedAt));
    return right.localeCompare(left);
  });
  const latest = sorted[0];
  const data = latest.data;
  const complete = data.declarationConfirmed === true && typeof data.signature === "string" && data.signature.trim().length > 0;
  if (!complete) return { status: "incomplete", formId: latest.id, validityFrom: "", validityTo: "", daysUntilExpiry: null, data };
  const validityFrom = typeof data.validityFrom === "string" && data.validityFrom ? data.validityFrom : timestampDate(data.submittedAt);
  const validityTo = typeof data.validityTo === "string" && data.validityTo ? data.validityTo : validityFrom ? leaderMedicalValidityEnd(validityFrom) : "";
  if (!validityTo) return { status: "incomplete", formId: latest.id, validityFrom, validityTo: "", daysUntilExpiry: null, data };
  const remaining = daysBetweenLocalDates(today, validityTo);
  const status: MedicalValidityStatus = remaining < 0 ? "lapsed" : remaining <= LEADER_MEDICAL_REMINDER_DAYS ? "approaching-expiry" : "current";
  return { status, formId: latest.id, validityFrom, validityTo, daysUntilExpiry: remaining, data };
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
  return leaderMedicalStateFromRecords(snapshot.docs.map((item) => ({ id: item.id, data: item.data() })));
}

export function leaderMedicalNeedsDashboardAction(status: MedicalValidityStatus): boolean {
  return status === "missing" || status === "incomplete" || status === "lapsed";
}
