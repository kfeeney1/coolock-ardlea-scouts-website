import { UserFacingError, reportApplicationError } from "./applicationErrors.ts";
import {
    addDoc,
    collection,
    serverTimestamp
} from "firebase/firestore";

import { auth, db } from "../firebase";
import { loadRegisteredScouterOptions } from "./emailNotifications";
import { firstYouthConsentValidationMessage, validateYouthConsent } from "./youthConsentValidation";

export type YesNo = "Yes" | "No";

export type ScoutSection = "Beavers" | "Cubs" | "Scouts" | "Ventures" | "Rovers" | "Scouter";
export type YouthScoutSection = Exclude<ScoutSection, "Scouter">;

export type MedicationEntry = {
    medicineName: string;
    dosage: string;
    frequency: string;
    quantitySupplied: string;
    method: string;
    otherInfo: string;
    selfAdmin: YesNo | "";
    authFrom: string;
    authTo: string;
};

export type MedicationManagementData = {
    enabled: boolean;
    /** Multiple medication entries. Legacy records may omit this and use the flat fields below. */
    medications?: MedicationEntry[];
    memberName: string;
    dateOfBirth: string;
    address: string;
    medicineName: string;
    dosage: string;
    frequency: string;
    quantitySupplied: string;
    doctorName: string;
    doctorTel: string;
    pharmacyName: string;
    pharmacyTel: string;
    method: string;
    otherInfo: string;
    selfAdmin: YesNo | "";
    authFrom: string;
    authTo: string;
    scouter1: string;
    scouter2: string;
    signature: string;
    signatureDate: string;
};

export type YouthConsentData = {
    scoutSection: YouthScoutSection | "";
    childName: string;
    childDOB: string;
    consentFrom: string;
    consentTo: string;
    photoConsent: YesNo | "";
    waterActivities: YesNo | "";
    canSwim: YesNo | "";
    seriousIllness: YesNo | "";
    regularMeds: YesNo | "";
    medAllergies: YesNo | "";
    allergies: YesNo | "";
    dietaryReqs: YesNo | "";
    vaccinated: YesNo | "";
    medicalFurtherInfo: string;
    gpName: string;
    gpTel: string;
    gpAddress: string;
    lastCheckup: string;
    parent1Name: string;
    parent2Name: string;
    homePhone: string;
    mobile1: string;
    mobile2: string;
    workPhone: string;
    email: string;
    homeAddress: string;
    altContactName: string;
    altContactPhone: string;
    additionalInfo: string;
    sig1Name: string;
    sig2Name: string;
    sigDate: string;
    declarationConfirmed: boolean;
    medicationManagement: MedicationManagementData;
};

export type ScouterConsentData = {
    scoutSection: "Scouter";
    name: string;
    dob: string;
    address: string;
    mobile: string;
    homePhone: string;
    workPhone: string;
    nextOfKinName: string;
    nextOfKinAddress: string;
    nextOfKinMobile: string;
    nextOfKinHome: string;
    nextOfKinWork: string;
    epilepsy: YesNo | "";
    diabetes: YesNo | "";
    asthma: YesNo | "";
    heartDisease: YesNo | "";
    highBloodPressure: YesNo | "";
    skinAllergies: YesNo | "";
    hearingDifficulties: YesNo | "";
    otherMedical: string;
    previousInjuries: string;
    onMedication: YesNo | "";
    medicationDetails: string;
    allergies: string;
    signature: string;
    signatureDate: string;
    declarationConfirmed: boolean;
    medicationManagement: MedicationManagementData;
};

const clean = (value: string, maxLength: number): string => value.trim().slice(0, maxLength);

function cleanMedication(medication: MedicationManagementData) {
    const entries = (medication.medications?.length ? medication.medications : [{
        medicineName: medication.medicineName, dosage: medication.dosage, frequency: medication.frequency,
        quantitySupplied: medication.quantitySupplied, method: medication.method, otherInfo: medication.otherInfo,
        selfAdmin: medication.selfAdmin, authFrom: medication.authFrom, authTo: medication.authTo
    }]).map((entry) => ({
        medicineName: clean(entry.medicineName, 200), dosage: clean(entry.dosage, 100), frequency: clean(entry.frequency, 150),
        quantitySupplied: clean(entry.quantitySupplied, 100), method: clean(entry.method, 300), otherInfo: clean(entry.otherInfo, 2000),
        selfAdmin: entry.selfAdmin, authFrom: entry.authFrom, authTo: entry.authTo
    }));
    const first = entries[0] ?? { medicineName: "", dosage: "", frequency: "", quantitySupplied: "", method: "", otherInfo: "", selfAdmin: "" as const, authFrom: "", authTo: "" };
    return {
        enabled: medication.enabled,
        medications: entries,
        // Retain the first entry in the legacy flat fields so existing readers remain compatible.
        memberName: clean(medication.memberName, 150),
        dateOfBirth: medication.dateOfBirth,
        address: clean(medication.address, 400),
        medicineName: first.medicineName,
        dosage: first.dosage,
        frequency: first.frequency,
        quantitySupplied: first.quantitySupplied,
        doctorName: clean(medication.doctorName, 150),
        doctorTel: clean(medication.doctorTel, 40),
        pharmacyName: clean(medication.pharmacyName, 150),
        pharmacyTel: clean(medication.pharmacyTel, 40),
        method: first.method,
        otherInfo: first.otherInfo,
        selfAdmin: first.selfAdmin,
        authFrom: first.authFrom,
        authTo: first.authTo,
        scouter1: clean(medication.scouter1, 150),
        scouter2: clean(medication.scouter2, 150),
        signature: clean(medication.signature, 150),
        signatureDate: medication.signatureDate
    };
}

let authorisedScouterPromise: Promise<string[]> | null = null;
export const AUTHORISED_SCOUTERS: string[] = [];

export type AuthorisedScouterOption = { uid: string; displayName: string; sections: string[]; scoutingRole: string };

export function orderAuthorisedScouters(options: AuthorisedScouterOption[], memberSection = ""): AuthorisedScouterOption[] {
    const unique = new Map<string, AuthorisedScouterOption>();
    for (const option of options) if (!unique.has(option.uid)) unique.set(option.uid, option);
    return [...unique.values()].sort((left, right) => {
        const leftRelevant = memberSection && left.sections.includes(memberSection) ? 0 : 1;
        const rightRelevant = memberSection && right.sections.includes(memberSection) ? 0 : 1;
        return leftRelevant - rightRelevant || left.displayName.localeCompare(right.displayName) || left.uid.localeCompare(right.uid);
    });
}

export async function loadAuthorisedScouterOptions(memberSection = ""): Promise<AuthorisedScouterOption[]> {
    const leaders = await loadRegisteredScouterOptions();
    return orderAuthorisedScouters(leaders, memberSection);
}

export async function loadAuthorisedScouterNames(): Promise<string[]> {
    if (!authorisedScouterPromise) {
        authorisedScouterPromise = getPublicWhosWho()
            .then((leaders) => [...new Set(leaders.map((leader) => leader.displayName).filter(Boolean))].sort((a, b) => a.localeCompare(b)))
            .catch((error) => {
                authorisedScouterPromise = null;
                throw error;
            });
    }
    return authorisedScouterPromise;
}

void loadAuthorisedScouterNames()
    .then((names) => AUTHORISED_SCOUTERS.splice(0, AUTHORISED_SCOUTERS.length, ...names))
    .catch((error) => reportApplicationError(error, { area: "consentApplications", operation: "Unable to load authorised Scouters from Firestore" }));

export async function submitYouthConsent(data: YouthConsentData): Promise<string> {
    const validationMessage = firstYouthConsentValidationMessage(validateYouthConsent(data));
    if (validationMessage) throw new Error(validationMessage);
    const { scoutSection, ...canonicalData } = data;
    const authorisedScouters = await loadAuthorisedScouterNames();
    const ref = await addDoc(collection(db, "consentApplications"), {
        ...canonicalData,
        section: scoutSection,
        childName: clean(data.childName, 150),
        medicalFurtherInfo: clean(data.medicalFurtherInfo, 3000),
        gpName: clean(data.gpName, 150),
        gpTel: clean(data.gpTel, 40),
        gpAddress: clean(data.gpAddress, 300),
        parent1Name: clean(data.parent1Name, 150),
        parent2Name: clean(data.parent2Name, 150),
        homePhone: clean(data.homePhone, 40),
        mobile1: clean(data.mobile1, 40),
        mobile2: clean(data.mobile2, 40),
        workPhone: clean(data.workPhone, 40),
        email: clean(data.email, 254).toLowerCase(),
        homeAddress: clean(data.homeAddress, 400),
        altContactName: clean(data.altContactName, 150),
        altContactPhone: clean(data.altContactPhone, 40),
        additionalInfo: clean(data.additionalInfo, 3000),
        sig1Name: clean(data.sig1Name, 150),
        sig2Name: clean(data.sig2Name, 150),
        medicationManagement: cleanMedication(data.medicationManagement),
        authorisedScouters,
        formType: "youth-activity-consent",
        formVersion: "stage2-2026-08",
        status: "active",
        source: "website",
        submittedAt: serverTimestamp()
    });
    return ref.id;
}

export async function submitScouterConsent(data: ScouterConsentData): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new UserFacingError("An active Leader account is required to submit a Scouter form.");

    const { scoutSection, ...canonicalData } = data;
    const ref = await addDoc(collection(db, "consentApplications"), {
        ...canonicalData,
        section: scoutSection,
        name: clean(data.name, 150),
        address: clean(data.address, 400),
        mobile: clean(data.mobile, 40),
        homePhone: clean(data.homePhone, 40),
        workPhone: clean(data.workPhone, 40),
        nextOfKinName: clean(data.nextOfKinName, 150),
        nextOfKinAddress: clean(data.nextOfKinAddress, 400),
        nextOfKinMobile: clean(data.nextOfKinMobile, 40),
        nextOfKinHome: clean(data.nextOfKinHome, 40),
        nextOfKinWork: clean(data.nextOfKinWork, 40),
        otherMedical: clean(data.otherMedical, 3000),
        previousInjuries: clean(data.previousInjuries, 3000),
        medicationDetails: clean(data.medicationDetails, 2000),
        allergies: clean(data.allergies, 1000),
        signature: clean(data.signature, 150),
        medicationManagement: cleanMedication(data.medicationManagement),
        formType: "scouter-es3-medical-advice",
        formVersion: "stage2-2026-08",
        status: "active",
        source: "website",
        submittedByUid: user.uid,
        submittedAt: serverTimestamp()
    });
    return ref.id;
}