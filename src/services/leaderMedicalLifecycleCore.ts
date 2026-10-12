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

export function leaderMedicalValidityEnd(completedOn: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(completedOn);
  if (!match) throw new Error("A valid local completion date is required.");
  const year = Number(match[1]);
  const month = Number(match[2]);
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

export function leaderMedicalStateFromPlainRecords(records: Array<{ id: string; data: Record<string, unknown>; submittedDate?: string }>, today: string): LeaderMedicalState {
  if (!records.length) return { status: "missing", formId: null, validityFrom: "", validityTo: "", daysUntilExpiry: null, data: null };
  const sorted = [...records].sort((a, b) => String(b.data.validityFrom || b.submittedDate || "").localeCompare(String(a.data.validityFrom || a.submittedDate || "")));
  const latest = sorted[0];
  const data = latest.data;
  const complete = data.declarationConfirmed === true && typeof data.signature === "string" && data.signature.trim().length > 0;
  if (!complete) return { status: "incomplete", formId: latest.id, validityFrom: "", validityTo: "", daysUntilExpiry: null, data };
  const validityFrom = typeof data.validityFrom === "string" && data.validityFrom ? data.validityFrom : latest.submittedDate || "";
  const validityTo = typeof data.validityTo === "string" && data.validityTo ? data.validityTo : validityFrom ? leaderMedicalValidityEnd(validityFrom) : "";
  if (!validityTo) return { status: "incomplete", formId: latest.id, validityFrom, validityTo: "", daysUntilExpiry: null, data };
  const remaining = daysBetweenLocalDates(today, validityTo);
  const status: MedicalValidityStatus = remaining < 0 ? "lapsed" : remaining <= LEADER_MEDICAL_REMINDER_DAYS ? "approaching-expiry" : "current";
  return { status, formId: latest.id, validityFrom, validityTo, daysUntilExpiry: remaining, data };
}

export function leaderMedicalNeedsDashboardAction(status: MedicalValidityStatus): boolean {
  return status === "missing" || status === "incomplete" || status === "lapsed";
}
