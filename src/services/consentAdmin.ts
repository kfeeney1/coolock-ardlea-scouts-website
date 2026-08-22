import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    where
} from "firebase/firestore";
import type {
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp
} from "firebase/firestore";

import { auth, db } from "../firebase";

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
    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (value as Timestamp).toDate === "function"
    ) {
        return (value as Timestamp).toDate();
    }
    return null;
}

function stringValue(data: DocumentData, key: string): string {
    const value = data[key];
    return typeof value === "string" ? value : "";
}

function yes(data: DocumentData, key: string): boolean {
    return data[key] === "Yes";
}

function medicationEnabled(data: DocumentData): boolean {
    const medication = data.medicationManagement;
    return Boolean(
        medication &&
        typeof medication === "object" &&
        "enabled" in medication &&
        medication.enabled === true
    );
}

function hasYouthMedicalAlert(data: DocumentData): boolean {
    return [
        "seriousIllness",
        "regularMeds",
        "medAllergies",
        "allergies",
        "dietaryReqs"
    ].some((key) => yes(data, key));
}

function hasScouterMedicalAlert(data: DocumentData): boolean {
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

function mapConsent(snapshot: QueryDocumentSnapshot<DocumentData>): ConsentAdminRecord {
    const data = snapshot.data();
    const isScouter = stringValue(data, "formType") === "scouter-es3-medical-advice";

    return {
        id: snapshot.id,
        type: isScouter ? "scouter" : "youth",
        section: stringValue(data, "section") || stringValue(data, "scoutSection") || (isScouter ? "Scouter" : ""),
        memberName: isScouter ? stringValue(data, "name") : stringValue(data, "childName"),
        memberId: stringValue(data, "memberId"),
        status: stringValue(data, "status") || "active",
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

function profileSections(data: DocumentData): string[] {
    const sections = Array.isArray(data.sections)
        ? data.sections.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
    const legacy = stringValue(data, "section").trim();
    return [...new Set([...sections.map((section) => section.trim()), legacy].filter(Boolean))];
}

export async function loadConsentAdminRecords(): Promise<ConsentAdminRecord[]> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const profileSnapshot = await getDoc(doc(db, "adminUsers", user.uid));
    if (!profileSnapshot.exists() || profileSnapshot.data().active !== true) {
        throw new Error("Active leader profile is required.");
    }

    const profile = profileSnapshot.data();
    const isAdmin = profile.role === "admin" || profile.role === "super-admin";

    let documents: QueryDocumentSnapshot<DocumentData>[];
    if (isAdmin) {
        documents = (await getDocs(query(collection(db, "consentApplications"), orderBy("submittedAt", "desc")))).docs;
    } else {
        const sections = profileSections(profile);
        if (sections.length === 0) return [];

        const snapshots = await Promise.all(
            sections.flatMap((section) => [
                getDocs(query(collection(db, "consentApplications"), where("section", "==", section))),
                getDocs(query(collection(db, "consentApplications"), where("scoutSection", "==", section)))
            ])
        );

        const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
        snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => byId.set(item.id, item)));
        documents = [...byId.values()];
    }

    return documents
        .map(mapConsent)
        .sort((left, right) => (right.submittedAt?.getTime() ?? 0) - (left.submittedAt?.getTime() ?? 0));
}

export function isConsentExpired(consentTo: string): boolean {
    if (!consentTo) return false;
    const today = new Date().toISOString().slice(0, 10);
    return consentTo < today;
}

export function daysUntilExpiry(consentTo: string): number | null {
    if (!consentTo) return null;
    const end = new Date(`${consentTo}T00:00:00`);
    if (Number.isNaN(end.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}
