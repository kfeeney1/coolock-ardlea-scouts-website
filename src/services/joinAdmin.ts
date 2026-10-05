import { ServiceFailure, UserFacingError, reportSecondaryFailure } from "./applicationErrors.ts";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    setDoc,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where
} from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot, Timestamp } from "firebase/firestore";

import { auth, db } from "../firebase";
import { notifyJoinApplicationStatus } from "./emailNotifications";
import { canonicalMemberSection } from "./memberIdentityLogic";
import { activeScoutingAppointments, isGroupLeadershipAppointment, normalizeScoutingAppointmentAssignments } from "../security/scoutingAppointments";

export type JoinStatus = "new" | "contacted" | "waiting-list" | "accepted" | "closed";
export type ContactMethod = "phone" | "email" | "text" | "in-person" | "other";

export type ContactHistoryEntry = {
    id: string;
    date: string;
    method: ContactMethod;
    note: string;
    leaderUid: string;
};

export type JoinApplicationRecord = {
    id: string;
    childFirstName: string;
    childLastName: string;
    childName: string;
    childDob: string;
    parentName: string;
    emailAddress: string;
    mobileNumber: string;
    section: string;
    status: JoinStatus;
    notes: string;
    contactHistory: ContactHistoryEntry[];
    submittedAt: Date | null;
    updatedAt: Date | null;
    memberId: string;
    data: Record<string, unknown>;
};

const JOIN_STATUSES = ["new", "contacted", "waiting-list", "accepted", "closed"] as const;
const CONTACT_METHODS = ["phone", "email", "text", "in-person", "other"] as const;

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

function mapContactHistory(value: unknown): ContactHistoryEntry[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        if (
            typeof record.id !== "string" ||
            typeof record.date !== "string" ||
            typeof record.method !== "string" ||
            !CONTACT_METHODS.includes(record.method as ContactMethod) ||
            typeof record.note !== "string" ||
            typeof record.leaderUid !== "string"
        ) return [];
        return [{
            id: record.id,
            date: record.date,
            method: record.method as ContactMethod,
            note: record.note.trim(),
            leaderUid: record.leaderUid
        }];
    });
}

function mapJoin(snapshot: QueryDocumentSnapshot<DocumentData>): JoinApplicationRecord | null {
    const data = snapshot.data();
    const childFirstName = stringValue(data, "childFirstName");
    const childLastName = stringValue(data, "childLastName");
    const childDob = stringValue(data, "dateOfBirth");
    const parentName = stringValue(data, "parentName");
    const emailAddress = stringValue(data, "emailAddress");
    const mobileNumber = stringValue(data, "mobileNumber");
    const section = stringValue(data, "section");
    const status = stringValue(data, "status") as JoinStatus;

    if (
        !childFirstName || !childLastName || !childDob || !parentName || !emailAddress || !mobileNumber || !section ||
        !JOIN_STATUSES.includes(status)
    ) return null;

    return {
        id: snapshot.id,
        childFirstName,
        childLastName,
        childName: `${childFirstName} ${childLastName}`.trim(),
        childDob,
        parentName,
        emailAddress,
        mobileNumber,
        section,
        status,
        notes: stringValue(data, "notes"),
        contactHistory: mapContactHistory(data.contactHistory),
        submittedAt: timestampToDate(data.submittedAt),
        updatedAt: timestampToDate(data.updatedAt),
        memberId: stringValue(data, "memberId"),
        data
    };
}

type JoinManagementAccess = { allSections: boolean; sections: string[] };

async function requireJoinManagementAccess(): Promise<JoinManagementAccess> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

    const [profileSnapshot, leadershipSnapshot] = await Promise.all([
        getDoc(doc(db, "adminUsers", user.uid)),
        getDoc(doc(db, "organisationLeadership", user.uid))
    ]);
    if (!profileSnapshot.exists() || profileSnapshot.data().active !== true) {
        throw new UserFacingError("Active leader profile is required.");
    }

    const profile = profileSnapshot.data();
    if (profile.role === "admin" || profile.role === "super-admin") return { allSections: true, sections: [] };

    const leadership = leadershipSnapshot.exists() ? leadershipSnapshot.data() : null;
    if (!leadership || leadership.active !== true) {
        throw new UserFacingError("Join Us Management is restricted to Section Leaders and Group Leadership.");
    }

    const appointments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(
        leadership.appointments,
        leadership.scoutingRole,
        leadership.organisationSection
    ));
    if (appointments.some((item) => isGroupLeadershipAppointment(item.appointment))) {
        return { allSections: true, sections: [] };
    }

    const sections = [...new Set(appointments
        .filter((item) => item.appointment === "Section Leader" && item.scope !== "Group")
        .map((item) => item.scope))];
    if (sections.length === 0) {
        throw new UserFacingError("Join Us Management is restricted to Section Leaders and Group Leadership.");
    }
    return { allSections: false, sections };
}

function assertJoinSectionAccess(access: JoinManagementAccess, section: string): void {
    if (!access.allSections && !access.sections.includes(section)) {
        throw new UserFacingError("You do not have Join Us Management access for this section.");
    }
}

export async function loadJoinApplications(): Promise<JoinApplicationRecord[]> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

    const access = await requireJoinManagementAccess();

    let documents: QueryDocumentSnapshot<DocumentData>[];
    if (access.allSections) {
        documents = (await getDocs(query(collection(db, "joinApplications"), orderBy("submittedAt", "desc")))).docs;
    } else {
        const snapshots = await Promise.all(
            access.sections.map((section) => getDocs(query(collection(db, "joinApplications"), where("section", "==", section))))
        );
        const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
        snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => byId.set(item.id, item)));
        documents = [...byId.values()];
    }

    return documents
        .map(mapJoin)
        .filter((record): record is JoinApplicationRecord => record !== null)
        .sort((left, right) => (right.submittedAt?.getTime() ?? 0) - (left.submittedAt?.getTime() ?? 0));
}

async function ensureAcceptedMember(application: JoinApplicationRecord): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

    const applicationRef = doc(db, "joinApplications", application.id);
    const currentApplication = await getDoc(applicationRef);
    if (!currentApplication.exists()) throw new UserFacingError("The joining application no longer exists.");
    const existingMemberId = stringValue(currentApplication.data(), "memberId");
    if (existingMemberId) return existingMemberId;

    const sourceMatches = await getDocs(query(collection(db, "members"), where("sourceJoinApplicationId", "==", application.id)));
    const exactSource = sourceMatches.docs[0];
    if (exactSource) {
        await updateDoc(applicationRef, { memberId: exactSource.id, convertedAt: serverTimestamp(), convertedBy: user.uid, updatedAt: serverTimestamp() });
        return exactSource.id;
    }

    const dobMatches = await getDocs(query(collection(db, "members"), where("dateOfBirth", "==", application.childDob)));
    const identityMatch = dobMatches.docs.find((item) => {
        const data = item.data();
        const displayName = stringValue(data, "displayName").toLowerCase();
        return displayName === application.childName.trim().toLowerCase();
    });
    if (identityMatch) {
        await updateDoc(applicationRef, {
            memberId: identityMatch.id,
            reconciledMemberAt: serverTimestamp(),
            reconciledMemberBy: user.uid,
            updatedAt: serverTimestamp()
        });
        return identityMatch.id;
    }

    const memberRef = doc(collection(db, "members"));
    await setDoc(memberRef, {
        firstName: application.childFirstName,
        lastName: application.childLastName,
        displayName: application.childName,
        dateOfBirth: application.childDob,
        section: canonicalMemberSection(application.section),
        parentName: application.parentName,
        emailAddress: application.emailAddress,
        mobileNumber: application.mobileNumber,
        emergencyContactName: stringValue(currentApplication.data(), "emergencyContactName"),
        emergencyContactPhone: stringValue(currentApplication.data(), "emergencyContactPhone"),
        status: "active",
        source: "join-application",
        sourceJoinApplicationId: application.id,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
    });
    await updateDoc(applicationRef, {
        memberId: memberRef.id,
        convertedAt: serverTimestamp(),
        convertedBy: user.uid,
        updatedAt: serverTimestamp()
    });
    return memberRef.id;
}

export async function saveJoinApplication(
    application: JoinApplicationRecord,
    status: JoinStatus,
    notes: string,
    stagedContacts: Array<{ method: ContactMethod; note: string }> = []
): Promise<{ memberId: string; status: JoinStatus; contactHistory: ContactHistoryEntry[] }> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");
    const access = await requireJoinManagementAccess();
    assertJoinSectionAccess(access, application.section);

    const applicationRef = doc(db, "joinApplications", application.id);
    const previousStatus = application.status;
    const now = new Date().toISOString();
    const newContacts = stagedContacts
        .map(({ method, note }) => ({ method, note: note.trim().slice(0, 1500) }))
        .filter(({ method, note }) => CONTACT_METHODS.includes(method) && Boolean(note))
        .map(({ method, note }) => ({
            id: crypto.randomUUID(),
            date: now,
            method,
            note,
            leaderUid: user.uid
        }));
    const contactHistory = [...application.contactHistory, ...newContacts];
    const finalStatus: JoinStatus = status === "new" && newContacts.length > 0 ? "contacted" : status;

    await updateDoc(applicationRef, {
        status: finalStatus,
        notes: notes.trim().slice(0, 5000),
        contactHistory,
        updatedAt: serverTimestamp()
    });

    let memberId = application.memberId;
    if (finalStatus === "accepted") memberId = await ensureAcceptedMember({ ...application, status: finalStatus, notes, contactHistory });

    if ((finalStatus === "waiting-list" || finalStatus === "accepted") && finalStatus !== previousStatus) {
        try {
            await notifyJoinApplicationStatus(application.id, finalStatus);
        } catch (emailError) {
            reportSecondaryFailure(emailError, { area: "joinAdmin", operation: "Unable to send Join Us status email" });
        }
    }
    return { memberId, status: finalStatus, contactHistory };
}

export async function updateJoinStatus(applicationId: string, status: JoinStatus): Promise<void> {
    const records = await loadJoinApplications();
    const application = records.find((item) => item.id === applicationId);
    if (!application) throw new UserFacingError("The joining application could not be found.");
    await saveJoinApplication(application, status, application.notes);
}

export async function updateJoinNotes(applicationId: string, notes: string): Promise<void> {
    const records = await loadJoinApplications();
    const application = records.find((item) => item.id === applicationId);
    if (!application) throw new UserFacingError("The joining application could not be found.");
    await saveJoinApplication(application, application.status, notes);
}

export async function convertJoinApplicationToMember(application: JoinApplicationRecord): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");
    const access = await requireJoinManagementAccess();
    assertJoinSectionAccess(access, application.section);

    const applicationRef = doc(db, "joinApplications", application.id);
    const memberRef = doc(collection(db, "members"));

    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(applicationRef);
        if (!snapshot.exists()) throw new UserFacingError("The joining application no longer exists.");

        const current = snapshot.data();
        if (current.memberId && typeof current.memberId === "string") {
            throw new UserFacingError("This enquiry has already been converted to a member.");
        }
        if (current.status !== "accepted") throw new UserFacingError("Only accepted joining enquiries can be converted to members.");

        transaction.set(memberRef, {
            firstName: application.childFirstName,
            lastName: application.childLastName,
            displayName: application.childName,
            dateOfBirth: application.childDob,
            section: canonicalMemberSection(application.section),
            parentName: application.parentName,
            emailAddress: application.emailAddress,
            mobileNumber: application.mobileNumber,
            emergencyContactName: stringValue(current, "emergencyContactName"),
            emergencyContactPhone: stringValue(current, "emergencyContactPhone"),
            status: "active",
            source: "join-application",
            sourceJoinApplicationId: application.id,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
        });

        transaction.update(applicationRef, {
            memberId: memberRef.id,
            convertedAt: serverTimestamp(),
            convertedBy: user.uid,
            updatedAt: serverTimestamp()
        });
    });

    return memberRef.id;
}
