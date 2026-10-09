import type { DocumentData, Timestamp } from "firebase/firestore";

import { normalizeMedicationManagement } from "./consentManagementLogic.ts";

export type MemberConsentSummary = {
  consentId: string;
  memberName: string;
  dateOfBirth: string;
  section: string;
  consentTo: string;
  submittedAt: Date | null;
  hasMedicalAlert: boolean;
  hasMedicationManagement: boolean;
};

function stringValue(data: DocumentData, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

function timestampToDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  return null;
}

export function mapMemberConsentSummary(
  consentId: string,
  data: DocumentData,
  memberId: string
): MemberConsentSummary | null {
  if (data.formType !== "youth-activity-consent" || stringValue(data, "memberId") !== memberId) return null;
  return {
    consentId,
    memberName: stringValue(data, "childName"),
    dateOfBirth: stringValue(data, "childDOB"),
    section: stringValue(data, "section"),
    consentTo: stringValue(data, "consentTo"),
    submittedAt: timestampToDate(data.submittedAt),
    hasMedicalAlert: ["seriousIllness", "regularMeds", "medAllergies", "allergies", "dietaryReqs"]
      .some((key) => data[key] === "Yes"),
    hasMedicationManagement: normalizeMedicationManagement(data.medicationManagement)?.enabled === true
  };
}
