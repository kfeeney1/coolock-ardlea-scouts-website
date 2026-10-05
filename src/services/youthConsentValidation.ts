import type { YouthConsentData } from "./consentApplications";
import { isValidPhone } from "./phoneInput.ts";

export type YouthConsentValidationErrors = Partial<Record<keyof YouthConsentData, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEDICAL_QUESTIONS: Array<keyof YouthConsentData> = [
  "seriousIllness", "regularMeds", "medAllergies", "allergies", "dietaryReqs"
];
const YES_NO_FIELDS: Array<keyof YouthConsentData> = [
  "photoConsent", "waterActivities", "canSwim",
  "seriousIllness", "regularMeds", "medAllergies", "allergies", "dietaryReqs", "vaccinated"
];

function text(data: YouthConsentData, field: keyof YouthConsentData): string {
  const value = data[field];
  return typeof value === "string" ? value.trim() : "";
}

function required(errors: YouthConsentValidationErrors, data: YouthConsentData, field: keyof YouthConsentData, message: string) {
  if (!text(data, field)) errors[field] = message;
}

function phone(errors: YouthConsentValidationErrors, data: YouthConsentData, field: keyof YouthConsentData, requiredField: boolean) {
  const value = text(data, field);
  if (!value) {
    if (requiredField) errors[field] = "Phone number is required.";
    return;
  }
  if (!isValidPhone(value)) errors[field] = "Enter a valid phone number.";
}

export function validateYouthConsent(data: YouthConsentData): YouthConsentValidationErrors {
  const errors: YouthConsentValidationErrors = {};
  required(errors, data, "childName", "Child's full name is required.");
  required(errors, data, "childDOB", "Date of birth is required.");
  required(errors, data, "consentFrom", "Start date is required.");
  required(errors, data, "consentTo", "End date is required.");
  if (data.consentFrom && data.consentTo && data.consentTo < data.consentFrom) errors.consentTo = "End date must be after start date.";

  for (const field of YES_NO_FIELDS) if (!text(data, field)) errors[field] = "Select Yes or No.";

  if (MEDICAL_QUESTIONS.some((field) => data[field] === "Yes") && !data.medicalFurtherInfo.trim()) {
    errors.medicalFurtherInfo = "Provide details for each medical, allergy, medication or dietary answer marked Yes.";
  }

  required(errors, data, "gpName", "GP name is required.");
  phone(errors, data, "gpTel", true);
  required(errors, data, "gpAddress", "GP address is required.");

  required(errors, data, "parent1Name", "Parent/guardian name is required.");
  phone(errors, data, "homePhone", false);
  phone(errors, data, "mobile1", true);
  phone(errors, data, "mobile2", Boolean(data.parent2Name.trim()));
  phone(errors, data, "workPhone", false);
  if (!data.email.trim()) errors.email = "Email address is required.";
  else if (!EMAIL_RE.test(data.email.trim())) errors.email = "Enter a valid email address.";
  required(errors, data, "homeAddress", "Home address is required.");
  required(errors, data, "altContactName", "Emergency contact name is required.");
  phone(errors, data, "altContactPhone", true);

  return errors;
}

export function firstYouthConsentValidationMessage(errors: YouthConsentValidationErrors): string {
  return Object.values(errors).find((value): value is string => Boolean(value)) ?? "";
}
