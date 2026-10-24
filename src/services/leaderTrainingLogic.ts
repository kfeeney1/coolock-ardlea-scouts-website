import { isIsoCalendarDate } from "./dateRangeLogic.ts";

export const trainingCategories = ["garda-vetting", "first-aid", "child-protection"] as const;
export type TrainingCategory = typeof trainingCategories[number];
export const trainingLabels: Record<TrainingCategory, string> = {
  "garda-vetting": "Garda vetting", "first-aid": "First Aid", "child-protection": "Child Protection"
};
export type TrainingDates = { completedDate: string; expiryDate: string };
export type LeaderTrainingRecord = TrainingDates & { revision: number };
export type TrainingStatus = "Current" | "Expired" | "Not recorded" | "Incomplete";

export function trainingDatesError(dates: TrainingDates): string {
  if (dates.completedDate && !isIsoCalendarDate(dates.completedDate)) return "Enter a valid completion / issue date.";
  if (dates.expiryDate && !isIsoCalendarDate(dates.expiryDate)) return "Enter a valid expiry / lapse date.";
  if (dates.completedDate && dates.expiryDate && dates.expiryDate < dates.completedDate) return "Expiry / lapse date must be on or after completion / issue date.";
  return "";
}

/** Dates remain ISO date-only strings; expiry is inclusive of the recorded day. */
export function trainingStatus(record: TrainingDates | undefined, today: string): TrainingStatus {
  if (!record || (!record.completedDate && !record.expiryDate)) return "Not recorded";
  if (!isIsoCalendarDate(today)) throw new Error("A valid date-only today is required.");
  if (trainingDatesError(record) || !record.completedDate || !record.expiryDate || record.completedDate > today) return "Incomplete";
  return record.expiryDate < today ? "Expired" : "Current";
}
