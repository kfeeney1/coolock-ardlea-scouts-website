import {
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
    medicationManagement: Record<string, unknown>;
    updatedByParent: boolean;
    parentUpdatedAt: Date | null;
    updatedAt: Date | null;
};

export type ParentLinkedMember = {
    id: string;
    displayName: string;
    section: string;
    dateOfBirth: string;
};

const stringValue = (data: Record<string, unknown>, key: string) =>
    typeof data[key] === "string" ? (data[key] as string).trim() : "";

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
        medicationManagement:
            data.medicationManagement && typeof data.medicationManagement === "object"
                ? (data.medicationManagement as Record<string, unknown>)
                : {},
        updatedByParent: data.updatedByParent === true,
        parentUpdatedAt: timestampToDate(data.parentUpdatedAt),
        updatedAt: timestampToDate(data.updatedAt)
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
        results.push({ id: snapshot.id, displayName, section, dateOfBirth });
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

export async function updateParentConsent(consentId: string, values: Partial<ParentConsentRecord>): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in parent.");

    await updateDoc(doc(db, "consentApplications", consentId), {
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
