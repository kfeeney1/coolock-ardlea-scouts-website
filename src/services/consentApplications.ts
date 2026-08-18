import {
    addDoc,
    collection,
    serverTimestamp
} from "firebase/firestore";

import { db } from "../firebase";

export type YesNo = "Yes" | "No";

export type ScoutSection =
    | "Beavers"
    | "Cubs"
    | "Scouts"
    | "Ventures"
    | "Rovers"
    | "Scouter";

export type YouthScoutSection = Exclude<
    ScoutSection,
    "Scouter"
>;

export type MedicationManagementData = {
    enabled: boolean;
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

export const AUTHORISED_SCOUTERS = [
    "Tony Groves",
    "John Sheridan",
    "Michael Kiely",
    "Valeria Filippin",
    "Ciaran Dolan",
    "Aoife Byrne",
    "Rebecca Bissett",
    "Ann-Marie Purcell",
    "Ronan Fields",
    "Siobhan Byrne",
    "Kevin Feeney",
    "Terry Curran",
    "Sinead Fitzpatrick",
    "Aine Sweetman",
    "Joe Vale",
    "Sean Parkes",
    "Ross Carolan"
] as const;

const clean = (
    value: string,
    maxLength: number
): string => value.trim().slice(0, maxLength);

function cleanMedication(
    medication: MedicationManagementData
) {
    return {
        enabled: medication.enabled,
        memberName: clean(medication.memberName, 150),
        dateOfBirth: medication.dateOfBirth,
        address: clean(medication.address, 400),
        medicineName: clean(medication.medicineName, 200),
        dosage: clean(medication.dosage, 100),
        frequency: clean(medication.frequency, 150),
        quantitySupplied: clean(
            medication.quantitySupplied,
            100
        ),
        doctorName: clean(medication.doctorName, 150),
        doctorTel: clean(medication.doctorTel, 40),
        pharmacyName: clean(
            medication.pharmacyName,
            150
        ),
        pharmacyTel: clean(medication.pharmacyTel, 40),
        method: clean(medication.method, 300),
        otherInfo: clean(medication.otherInfo, 2000),
        selfAdmin: medication.selfAdmin,
        authFrom: medication.authFrom,
        authTo: medication.authTo,
        scouter1: clean(medication.scouter1, 150),
        scouter2: clean(medication.scouter2, 150),
        signature: clean(medication.signature, 150),
        signatureDate: medication.signatureDate
    };
}

export async function submitYouthConsent(
    data: YouthConsentData
): Promise<string> {
    const ref = await addDoc(
        collection(db, "consentApplications"),
        {
            ...data,
            childName: clean(data.childName, 150),
            medicalFurtherInfo: clean(
                data.medicalFurtherInfo,
                3000
            ),
            gpName: clean(data.gpName, 150),
            gpTel: clean(data.gpTel, 40),
            gpAddress: clean(data.gpAddress, 300),
            parent1Name: clean(data.parent1Name, 150),
            parent2Name: clean(data.parent2Name, 150),
            homePhone: clean(data.homePhone, 40),
            mobile1: clean(data.mobile1, 40),
            workPhone: clean(data.workPhone, 40),
            email: clean(data.email, 254).toLowerCase(),
            homeAddress: clean(data.homeAddress, 400),
            altContactName: clean(
                data.altContactName,
                150
            ),
            altContactPhone: clean(
                data.altContactPhone,
                40
            ),
            additionalInfo: clean(
                data.additionalInfo,
                3000
            ),
            sig1Name: clean(data.sig1Name, 150),
            sig2Name: clean(data.sig2Name, 150),
            medicationManagement: cleanMedication(
                data.medicationManagement
            ),
            authorisedScouters: [...AUTHORISED_SCOUTERS],
            formType: "youth-activity-consent",
            formVersion: "stage2-2026-08",
            status: "active",
            source: "website",
            submittedAt: serverTimestamp()
        }
    );

    return ref.id;
}

export async function submitScouterConsent(
    data: ScouterConsentData
): Promise<string> {
    const ref = await addDoc(
        collection(db, "consentApplications"),
        {
            ...data,
            name: clean(data.name, 150),
            address: clean(data.address, 400),
            mobile: clean(data.mobile, 40),
            homePhone: clean(data.homePhone, 40),
            workPhone: clean(data.workPhone, 40),

            nextOfKinName: clean(
                data.nextOfKinName,
                150
            ),
            nextOfKinAddress: clean(
                data.nextOfKinAddress,
                400
            ),
            nextOfKinMobile: clean(
                data.nextOfKinMobile,
                40
            ),
            nextOfKinHome: clean(
                data.nextOfKinHome,
                40
            ),
            nextOfKinWork: clean(
                data.nextOfKinWork,
                40
            ),

            otherMedical: clean(data.otherMedical, 3000),
            previousInjuries: clean(
                data.previousInjuries,
                3000
            ),
            medicationDetails: clean(
                data.medicationDetails,
                2000
            ),
            allergies: clean(data.allergies, 1000),
            signature: clean(data.signature, 150),
            medicationManagement: cleanMedication(
                data.medicationManagement
            ),

            formType: "scouter-es3-medical-advice",
            formVersion: "stage2-2026-08",
            status: "active",
            source: "website",
            submittedAt: serverTimestamp()
        }
    );

    return ref.id;
}
