import {
    collection,
    getDocs,
    orderBy,
    query
} from "firebase/firestore";
import type {
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp
} from "firebase/firestore";

import { db } from "../firebase";

export type ConsentType =
    | "youth"
    | "scouter";

export type ConsentStatus =
    | "active"
    | "reviewed"
    | "expired"
    | "archived";

export type ConsentAdminRecord = {
    id: string;
    type: ConsentType;
    section: string;
    memberName: string;
    status: string;
    submittedAt: Date | null;
    consentFrom: string;
    consentTo: string;
    hasMedicationManagement: boolean;
    hasMedicalAlert: boolean;
    data: Record<string, unknown>;
};

function timestampToDate(
    value: unknown
): Date | null {
    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (
            value as Timestamp
        ).toDate === "function"
    ) {
        return (
            value as Timestamp
        ).toDate();
    }

    return null;
}

function stringValue(
    data: DocumentData,
    key: string
): string {
    const value = data[key];

    return typeof value === "string"
        ? value
        : "";
}

function yes(
    data: DocumentData,
    key: string
): boolean {
    return data[key] === "Yes";
}

function medicationEnabled(
    data: DocumentData
): boolean {
    const medication =
        data.medicationManagement;

    return Boolean(
        medication &&
        typeof medication === "object" &&
        "enabled" in medication &&
        medication.enabled === true
    );
}

function hasYouthMedicalAlert(
    data: DocumentData
): boolean {
    return [
        "seriousIllness",
        "regularMeds",
        "medAllergies",
        "allergies",
        "dietaryReqs"
    ].some((key) => yes(data, key));
}

function hasScouterMedicalAlert(
    data: DocumentData
): boolean {
    return [
        "epilepsy",
        "diabetes",
        "asthma",
        "heartDisease",
        "highBloodPressure",
        "skinAllergies",
        "hearingDifficulties",
        "onMedication"
    ].some((key) => yes(data, key));
}

function mapConsent(
    snapshot: QueryDocumentSnapshot<DocumentData>
): ConsentAdminRecord {
    const data = snapshot.data();

    const isScouter =
        stringValue(data, "formType") ===
        "scouter-es3-medical-advice";

    return {
        id: snapshot.id,
        type: isScouter
            ? "scouter"
            : "youth",
        section:
            stringValue(
                data,
                "scoutSection"
            ) ||
            (isScouter
                ? "Scouter"
                : ""),
        memberName:
            isScouter
                ? stringValue(data, "name")
                : stringValue(
                      data,
                      "childName"
                  ),
        status:
            stringValue(data, "status") ||
            "active",
        submittedAt: timestampToDate(
            data.submittedAt
        ),
        consentFrom:
            stringValue(
                data,
                "consentFrom"
            ),
        consentTo:
            stringValue(
                data,
                "consentTo"
            ),
        hasMedicationManagement:
            medicationEnabled(data),
        hasMedicalAlert:
            isScouter
                ? hasScouterMedicalAlert(
                      data
                  )
                : hasYouthMedicalAlert(
                      data
                  ),
        data
    };
}

export async function loadConsentAdminRecords(): Promise<
    ConsentAdminRecord[]
> {
    const snapshot = await getDocs(
        query(
            collection(
                db,
                "consentApplications"
            ),
            orderBy(
                "submittedAt",
                "desc"
            )
        )
    );

    return snapshot.docs.map(
        mapConsent
    );
}

export function isConsentExpired(
    consentTo: string
): boolean {
    if (!consentTo) {
        return false;
    }

    const today =
        new Date()
            .toISOString()
            .slice(0, 10);

    return consentTo < today;
}

export function daysUntilExpiry(
    consentTo: string
): number | null {
    if (!consentTo) {
        return null;
    }

    const end =
        new Date(
            `${consentTo}T00:00:00`
        );

    if (
        Number.isNaN(
            end.getTime()
        )
    ) {
        return null;
    }

    const now = new Date();
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    return Math.ceil(
        (
            end.getTime() -
            today.getTime()
        ) /
            86_400_000
    );
}
