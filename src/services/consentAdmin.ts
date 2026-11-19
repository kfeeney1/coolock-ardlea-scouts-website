import type { DocumentData, Timestamp } from "firebase/firestore";
import { readLeaderConsent } from "./leaderConsentRead";
import { normalizeMedicationManagement } from "./consentManagementLogic";
export { daysUntilExpiry, isConsentExpired } from "./consentDateLogic";

export type ConsentType = "youth" | "scouter";
export type ConsentStatus = "active" | "reviewed" | "expired" | "archived";

export type ConsentAdminRecord = {
    id: string;
    type: ConsentType;
    section: string;
    memberName: string;
    memberId: string;
    status: string;
    submittedAt: Date | null;
    updatedAt: Date | null;
    parentUpdatedAt: Date | null;
    updatedByParent: boolean;
    consentFrom: string;
    consentTo: string;
    hasMedicationManagement: boolean;
    hasMedicalAlert: boolean;
    data: Record<string, unknown>;
};

function timestampToDate(value: unknown): Date | null {
    if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
        return (value as Timestamp).toDate();
    }
    return null;
}

function stringValue(data: DocumentData, key: string): string {
    const value = data[key];
    return typeof value === "string" ? value.trim() : "";
}

function yes(data: DocumentData, key: string): boolean {
    return data[key] === "Yes";
}

function medicationEnabled(data: DocumentData): boolean {
    return normalizeMedicationManagement(data.medicationManagement)?.enabled === true;
}

function hasYouthMedicalAlert(data: DocumentData): boolean {
    return ["seriousIllness", "regularMeds", "medAllergies", "allergies", "dietaryReqs"].some((key) => yes(data, key));
}

function hasScouterMedicalAlert(data: DocumentData): boolean {
    return ["epilepsy", "diabetes", "asthma", "heartDisease", "highBloodPressure", "skinAllergies", "hearingDifficulties", "onMedication"].some((key) => yes(data, key));
}

function mapConsent({ id, section, data }: { id: string; section: string; data: DocumentData }): ConsentAdminRecord | null {
    const formType = stringValue(data, "formType");
    if (formType !== "youth-activity-consent" && formType !== "scouter-es3-medical-advice") return null;

    const isScouter = formType === "scouter-es3-medical-advice";
    const memberName = isScouter ? stringValue(data, "name") : stringValue(data, "childName");
    const status = stringValue(data, "status");
    if (!section || !memberName || !["active", "reviewed", "expired", "archived"].includes(status)) return null;

    return {
        id,
        type: isScouter ? "scouter" : "youth",
        section,
        memberName,
        memberId: stringValue(data, "memberId"),
        status,
        submittedAt: timestampToDate(data.submittedAt),
        updatedAt: timestampToDate(data.updatedAt),
        parentUpdatedAt: timestampToDate(data.parentUpdatedAt),
        updatedByParent: data.updatedByParent === true,
        consentFrom: stringValue(data, "consentFrom"),
        consentTo: stringValue(data, "consentTo"),
        hasMedicationManagement: medicationEnabled(data),
        hasMedicalAlert: isScouter ? hasScouterMedicalAlert(data) : hasYouthMedicalAlert(data),
        data
    };
}

export async function loadConsentAdminRecord(consentId: string): Promise<ConsentAdminRecord | null> {
    const [document] = await readLeaderConsent(consentId);
    return document ? mapConsent(document) : null;
}

export async function loadConsentAdminRecords(): Promise<ConsentAdminRecord[]> {
    return (await readLeaderConsent())
        .map(mapConsent)
        .filter((record): record is ConsentAdminRecord => record !== null)
        .sort((left, right) => (right.submittedAt?.getTime() ?? 0) - (left.submittedAt?.getTime() ?? 0));
}
