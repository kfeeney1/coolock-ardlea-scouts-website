import type { ConsentAdminRecord } from "./consentAdmin.ts";

export type MedicalPresentationGroupId = "immediate" | "medication" | "ongoing" | "supporting";

export type MedicalPresentationItem = {
  key: string;
  label: string;
  value: unknown;
  group: MedicalPresentationGroupId;
};

export type MedicalPresentationGroup = {
  id: MedicalPresentationGroupId;
  heading: string;
  items: MedicalPresentationItem[];
};

const GROUPS: Array<{ id: MedicalPresentationGroupId; heading: string; fields: string[] }> = [
  {
    id: "immediate",
    heading: "Immediate warnings and emergency action",
    fields: ["seriousIllness", "medAllergies", "allergies", "epilepsy", "diabetes", "asthma", "heartDisease", "skinAllergies"]
  },
  {
    id: "medication",
    heading: "Medication administration",
    fields: ["regularMeds", "onMedication"]
  },
  {
    id: "ongoing",
    heading: "Ongoing conditions and support",
    fields: ["dietaryReqs", "medicalFurtherInfo", "hearingDifficulties", "highBloodPressure", "additionalInfo"]
  },
  {
    id: "supporting",
    heading: "Supporting and administrative information",
    fields: ["gpName", "gpTel", "gpAddress", "lastCheckup", "vaccinated"]
  }
];

const EXCLUDED = new Set([
  "submittedAt", "authorisedScouters", "medicationManagement",
  "formType", "status", "section", "memberId", "childName", "childDOB",
  "name", "consentFrom", "consentTo", "updatedAt", "updatedBy",
  "parentUpdatedAt", "updatedByParent"
]);

export const medicalPresentationDefinition = GROUPS;

export function medicalPresentationGroups(
  record: ConsentAdminRecord,
  formatLabel: (key: string) => string,
  display: (value: unknown) => string
): MedicalPresentationGroup[] {
  const used = new Set<string>();
  const groups = GROUPS.map((definition) => ({
    id: definition.id,
    heading: definition.heading,
    items: definition.fields.flatMap((key) => {
      const value = record.data[key];
      if (!display(value).trim()) return [];
      used.add(key);
      return [{ key, label: formatLabel(key), value, group: definition.id }];
    })
  }));

  // Unknown legacy fields retain a neutral supporting placement. They are not
  // assigned invented clinical urgency and remain visible when renderable.
  const unknown = Object.entries(record.data).flatMap(([key, value]) => {
    if (used.has(key) || EXCLUDED.has(key) || !display(value).trim()) return [];
    return [{ key, label: formatLabel(key), value, group: "supporting" as const }];
  });
  groups[groups.length - 1].items.push(...unknown);
  return groups;
}

export function hasImportantMedicalInformation(record: ConsentAdminRecord): boolean {
  return record.hasMedicalAlert || record.hasMedicationManagement;
}
