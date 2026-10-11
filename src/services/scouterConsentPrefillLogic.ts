import type { MedicationManagementData, ScouterConsentData } from "./consentApplications";
import type { LeaderMedicalDefaults } from "./leaderProfile";

const identityFields = ["name", "dob", "address", "mobile", "homePhone", "workPhone"] as const;

const medicalFields = [
  "nextOfKinName", "nextOfKinAddress", "nextOfKinMobile", "nextOfKinHome", "nextOfKinWork",
  "epilepsy", "diabetes", "asthma", "heartDisease", "highBloodPressure", "skinAllergies",
  "hearingDifficulties", "otherMedical", "previousInjuries", "onMedication", "medicationDetails", "allergies"
] as const;

/**
 * Keep completed-form values first, use own-profile defaults for empty identity
 * fields, and preserve any edits made while profile data was still loading.
 */
export function mergeScouterConsentPrefill(
  current: ScouterConsentData,
  previous: Record<string, unknown> | null,
  profile: LeaderMedicalDefaults,
  editedFields: ReadonlySet<string> = new Set()
): ScouterConsentData {
  const next = { ...current };
  for (const field of identityFields) {
    if (editedFields.has(field)) continue;
    const saved = previous?.[field];
    next[field] = typeof saved === "string" && saved.trim() ? saved : profile[field] || current[field];
  }
  for (const field of medicalFields) {
    if (editedFields.has(field)) continue;
    const saved = previous?.[field];
    if (typeof saved === "string" && saved.trim()) next[field] = saved as never;
  }

  const previousMedication = previous?.medicationManagement;
  if (!editedFields.has("medicationManagement") && previousMedication && typeof previousMedication === "object") {
    next.medicationManagement = {
      ...current.medicationManagement,
      ...(previousMedication as Partial<MedicationManagementData>),
      signature: "",
      signatureDate: current.medicationManagement.signatureDate
    };
  }
  // A former signature or declaration must never authorize a renewed period.
  next.signature = "";
  next.declarationConfirmed = false;
  return next;
}

export function applyResolvedScouterConsentPrefill(
  current: ScouterConsentData,
  resolved: ScouterConsentData,
  editedFields: ReadonlySet<string>
): ScouterConsentData {
  const next = { ...resolved };
  for (const field of Object.keys(current) as Array<keyof ScouterConsentData>) {
    if (editedFields.has(field)) next[field] = current[field] as never;
  }
  return next;
}
