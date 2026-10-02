import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";

import { auth, db } from "../firebase";
import { canonicalMemberSections } from "./memberSectionCore.mjs";
import { medicationAuthorisationDefaults } from "./medicationAuthorisationDates";
import type { MedicationManagementData, YouthConsentData, YouthScoutSection } from "./consentApplications";
import { firstYouthConsentValidationMessage, validateYouthConsent } from "./youthConsentValidation";

export type ParentConsentRecord = {
    id: string;
    memberId: string;
    childName: string;
    childDOB: string;
    scoutSection: string;
    consentFrom: string;
    consentTo: string;
    photoConsent: string;
    waterActivities: string;
    canSwim: string;
    seriousIllness: string;
    regularMeds: string;
    medAllergies: string;
    allergies: string;
    dietaryReqs: string;
    vaccinated: string;
    medicalFurtherInfo: string;
    gpName: string;
    gpTel: string;
    gpAddress: string;
    lastCheckup: string;
    parent1Name: string;
    parent2Name: string;
    homePhone: string;
    mobile1: string;
    workPhone: string;
    email: string;
    homeAddress: string;
    altContactName: string;
    altContactPhone: string;
    additionalInfo: string;
    medicationManagement: MedicationManagementData;
    updatedByParent: boolean;
    submittedAt: Date | null;
    parentUpdatedAt: Date | null;
    updatedAt: Date | null;
};

export type ParentLinkedMember = {
    id: string;
    displayName: string;
    section: string;
    sections: string[];
    dateOfBirth: string;
};

const stringValue = (data: Record<string, unknown>, key: string) =>
    typeof data[key] === "string" ? (data[key] as string).trim() : "";

const EMPTY_MEDICATION: MedicationManagementData = {
    enabled: false, memberName: "", dateOfBirth: "", address: "", medicineName: "", dosage: "",
    frequency: "", quantitySupplied: "", doctorName: "", doctorTel: "", pharmacyName: "", pharmacyTel: "",
    method: "", otherInfo: "", selfAdmin: "", authFrom: "", authTo: "", scouter1: "", scouter2: "",
    signature: "", signatureDate: ""
};

function medicationValue(value: unknown): MedicationManagementData {
    if (!value || typeof value !== "object") return { ...EMPTY_MEDICATION };
    const normalized = { ...EMPTY_MEDICATION, ...(value as Partial<MedicationManagementData>), enabled: (value as { enabled?: unknown }).enabled === true };
    if (!Array.isArray(normalized.medications) || normalized.medications.length === 0) {
        normalized.medications = [{
            medicineName: normalized.medicineName, dosage: normalized.dosage, frequency: normalized.frequency,
            quantitySupplied: normalized.quantitySupplied, method: normalized.method, otherInfo: normalized.otherInfo,
            selfAdmin: normalized.selfAdmin, authFrom: normalized.authFrom, authTo: normalized.authTo
        }];
    }
    return normalized;
}

function timestampToDate(value: unknown): Date | null {
    if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
        return (value as Timestamp).toDate();
    }
    return null;
}

function mapConsent(id: string, data: Record<string, unknown>): ParentConsentRecord | null {
    if (data.formType !== "youth-activity-consent") return null;
    const memberId = stringValue(data, "memberId");
    const childName = stringValue(data, "childName");
    const childDOB = stringValue(data, "childDOB");
    const section = stringValue(data, "section");
    if (!memberId || !childName || !childDOB || !section) return null;

    return {
        id,
        memberId,
        childName,
        childDOB,
        scoutSection: section,
        consentFrom: stringValue(data, "consentFrom"),
        consentTo: stringValue(data, "consentTo"),
        photoConsent: stringValue(data, "photoConsent"),
        waterActivities: stringValue(data, "waterActivities"),
        canSwim: stringValue(data, "canSwim"),
        seriousIllness: stringValue(data, "seriousIllness"),
        regularMeds: stringValue(data, "regularMeds"),
        medAllergies: stringValue(data, "medAllergies"),
        allergies: stringValue(data, "allergies"),
        dietaryReqs: stringValue(data, "dietaryReqs"),
        vaccinated: stringValue(data, "vaccinated"),
        medicalFurtherInfo: stringValue(data, "medicalFurtherInfo"),
        gpName: stringValue(data, "gpName"),
        gpTel: stringValue(data, "gpTel"),
        gpAddress: stringValue(data, "gpAddress"),
        lastCheckup: stringValue(data, "lastCheckup"),
        parent1Name: stringValue(data, "parent1Name"),
        parent2Name: stringValue(data, "parent2Name"),
        homePhone: stringValue(data, "homePhone"),
        mobile1: stringValue(data, "mobile1"),
        workPhone: stringValue(data, "workPhone"),
        email: stringValue(data, "email"),
        homeAddress: stringValue(data, "homeAddress"),
        altContactName: stringValue(data, "altContactName"),
        altContactPhone: stringValue(data, "altContactPhone"),
        additionalInfo: stringValue(data, "additionalInfo"),
        medicationManagement: {
            ...medicationValue(data.medicationManagement),
            // Shared identity comes from the canonical linked consent/member projection, not a stale medication copy.
            memberName: childName,
            dateOfBirth: childDOB,
            address: stringValue(data, "homeAddress") || medicationValue(data.medicationManagement).address
        },
        updatedByParent: data.updatedByParent === true,
        submittedAt: timestampToDate(data.submittedAt),
        parentUpdatedAt: timestampToDate(data.parentUpdatedAt),
        updatedAt: timestampToDate(data.updatedAt)
    };
}

export function createParentConsentDraft(member: ParentLinkedMember): ParentConsentRecord {
    const medicationDates = medicationAuthorisationDefaults();
    return {
        id: "",
        memberId: member.id,
        childName: member.displayName,
        childDOB: member.dateOfBirth,
        scoutSection: member.section,
        consentFrom: "",
        consentTo: "",
        photoConsent: "",
        waterActivities: "",
        canSwim: "",
        seriousIllness: "",
        regularMeds: "",
        medAllergies: "",
        allergies: "",
        dietaryReqs: "",
        vaccinated: "",
        medicalFurtherInfo: "",
        gpName: "",
        gpTel: "",
        gpAddress: "",
        lastCheckup: "",
        parent1Name: "",
        parent2Name: "",
        homePhone: "",
        mobile1: "",
        workPhone: "",
        email: "",
        homeAddress: "",
        altContactName: "",
        altContactPhone: "",
        additionalInfo: "",
        medicationManagement: {
            ...EMPTY_MEDICATION,
            memberName: member.displayName,
            dateOfBirth: member.dateOfBirth,
            authFrom: medicationDates.authFrom,
            authTo: medicationDates.authTo
        },
        updatedByParent: false,
        submittedAt: null,
        parentUpdatedAt: null,
        updatedAt: null
    };
}

export async function loadLinkedMembers(memberIds: string[]): Promise<ParentLinkedMember[]> {
    const results: ParentLinkedMember[] = [];
    for (const memberId of memberIds) {
        const snapshot = await getDoc(doc(db, "members", memberId));
        if (!snapshot.exists()) continue;
        const data = snapshot.data();
        const displayName = stringValue(data, "displayName");
        const section = stringValue(data, "section");
        const dateOfBirth = stringValue(data, "dateOfBirth");
        if (!displayName || !section || !dateOfBirth) continue;
        const sections = canonicalMemberSections(data.sections, section);
        results.push({ id: snapshot.id, displayName, section, sections, dateOfBirth });
    }
    return results;
}

export async function loadParentConsents(memberIds: string[]): Promise<ParentConsentRecord[]> {
    const results: ParentConsentRecord[] = [];
    for (const memberId of memberIds) {
        const snapshot = await getDocs(query(collection(db, "consentApplications"), where("memberId", "==", memberId)));
        for (const item of snapshot.docs) {
            const mapped = mapConsent(item.id, item.data());
            if (mapped) results.push(mapped);
        }
    }
    return results;
}

function parentValidationData(values: Partial<ParentConsentRecord>): YouthConsentData {
    return {
        scoutSection: (values.scoutSection ?? "") as YouthScoutSection | "",
        childName: values.childName ?? "", childDOB: values.childDOB ?? "",
        consentFrom: values.consentFrom ?? "", consentTo: values.consentTo ?? "",
        photoConsent: (values.photoConsent ?? "") as YouthConsentData["photoConsent"],
        waterActivities: (values.waterActivities ?? "") as YouthConsentData["waterActivities"],
        canSwim: (values.canSwim ?? "") as YouthConsentData["canSwim"],
        seriousIllness: (values.seriousIllness ?? "") as YouthConsentData["seriousIllness"],
        regularMeds: (values.regularMeds ?? "") as YouthConsentData["regularMeds"],
        medAllergies: (values.medAllergies ?? "") as YouthConsentData["medAllergies"],
        allergies: (values.allergies ?? "") as YouthConsentData["allergies"],
        dietaryReqs: (values.dietaryReqs ?? "") as YouthConsentData["dietaryReqs"],
        vaccinated: (values.vaccinated ?? "") as YouthConsentData["vaccinated"],
        medicalFurtherInfo: values.medicalFurtherInfo ?? "",
        gpName: values.gpName ?? "", gpTel: values.gpTel ?? "", gpAddress: values.gpAddress ?? "", lastCheckup: values.lastCheckup ?? "",
        parent1Name: values.parent1Name ?? "", parent2Name: values.parent2Name ?? "", homePhone: values.homePhone ?? "",
        mobile1: values.mobile1 ?? "", workPhone: values.workPhone ?? "", email: values.email ?? "", homeAddress: values.homeAddress ?? "",
        altContactName: values.altContactName ?? "", altContactPhone: values.altContactPhone ?? "", additionalInfo: values.additionalInfo ?? "",
        sig1Name: "Parent Portal retained declaration", sig2Name: "", sigDate: values.parentUpdatedAt?.toISOString().slice(0, 10) ?? "retained",
        declarationConfirmed: true, medicationManagement: values.medicationManagement ?? { ...EMPTY_MEDICATION }
    };
}

export function validateParentConsentRecord(values: Partial<ParentConsentRecord>) {
    return validateYouthConsent(parentValidationData(values));
}

export async function updateParentConsent(consentId: string, values: Partial<ParentConsentRecord>): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in parent.");
    const validationMessage = firstYouthConsentValidationMessage(validateParentConsentRecord(values));
    if (validationMessage) throw new Error(validationMessage);

    const parentFields = {
        consentFrom: values.consentFrom ?? "",
        consentTo: values.consentTo ?? "",
        photoConsent: values.photoConsent ?? "",
        waterActivities: values.waterActivities ?? "",
        canSwim: values.canSwim ?? "",
        seriousIllness: values.seriousIllness ?? "",
        regularMeds: values.regularMeds ?? "",
        medAllergies: values.medAllergies ?? "",
        allergies: values.allergies ?? "",
        dietaryReqs: values.dietaryReqs ?? "",
        vaccinated: values.vaccinated ?? "",
        medicalFurtherInfo: values.medicalFurtherInfo ?? "",
        gpName: values.gpName ?? "",
        gpTel: values.gpTel ?? "",
        gpAddress: values.gpAddress ?? "",
        lastCheckup: values.lastCheckup ?? "",
        parent1Name: values.parent1Name ?? "",
        parent2Name: values.parent2Name ?? "",
        homePhone: values.homePhone ?? "",
        mobile1: values.mobile1 ?? "",
        workPhone: values.workPhone ?? "",
        email: (values.email ?? "").trim().toLowerCase(),
        homeAddress: values.homeAddress ?? "",
        altContactName: values.altContactName ?? "",
        altContactPhone: values.altContactPhone ?? "",
        additionalInfo: values.additionalInfo ?? "",
        medicationManagement: values.medicationManagement ?? {},
        updatedByParent: true,
        parentUpdatedBy: user.uid,
        parentUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    if (consentId) {
        await updateDoc(doc(db, "consentApplications", consentId), parentFields);
        return;
    }

    const memberId = values.memberId?.trim() ?? "";
    if (!memberId) throw new Error("A linked member is required to create consent.");

    // Re-read the linked member so identity fields cannot be supplied or changed by the form.
    // Firestore rules only allow an approved parent to read a member linked to their account.
    const memberSnapshot = await getDoc(doc(db, "members", memberId));
    if (!memberSnapshot.exists()) throw new Error("The linked member could not be found.");
    const member = memberSnapshot.data();
    const childName = stringValue(member, "displayName");
    const childDOB = stringValue(member, "dateOfBirth");
    const section = stringValue(member, "section");
    if (!childName || !childDOB || !section) {
        throw new Error("The linked member is missing required identity information.");
    }

    await addDoc(collection(db, "consentApplications"), {
        ...parentFields,
        memberId,
        childName,
        childDOB,
        section,
        formType: "youth-activity-consent",
        formVersion: "stage2-2026-08",
        status: "active",
        source: "website",
        submittedAt: serverTimestamp()
    });
}

export async function linkConsentRecordsToMembers(memberIds: string[]): Promise<number> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const consentSnapshot = await getDocs(collection(db, "consentApplications"));
    let linked = 0;

    for (const memberId of memberIds) {
        const memberSnapshot = await getDoc(doc(db, "members", memberId));
        if (!memberSnapshot.exists()) continue;
        const member = memberSnapshot.data();
        const memberName = stringValue(member, "displayName").toLowerCase();
        const memberDob = stringValue(member, "dateOfBirth");
        if (!memberName || !memberDob) continue;

        for (const consent of consentSnapshot.docs) {
            const data = consent.data();
            if (data.formType !== "youth-activity-consent") continue;
            if (typeof data.memberId === "string" && data.memberId) continue;
            const childName = stringValue(data, "childName").toLowerCase();
            const childDob = stringValue(data, "childDOB");
            if (childName === memberName && childDob === memberDob) {
                await updateDoc(consent.ref, {
                    memberId,
                    linkedBy: user.uid,
                    linkedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                linked += 1;
            }
        }
    }

    return linked;
}
