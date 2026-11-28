import { reportSecondaryFailure, ServiceFailure } from "./applicationErrors.ts";
import {
    addDoc,
    collection,
    doc,
    runTransaction,
    serverTimestamp
} from "firebase/firestore";

import { auth, db } from "../firebase";
import { notifyJoinApplication } from "./emailNotifications";

export type JoinApplication = {
    childFirstName: string;
    childLastName: string;
    dateOfBirth: string;
    school: string;
    parentName: string;
    relationship: string;
    mobileNumber: string;
    emailAddress: string;
    section: string;
    previousScoutExperience: string;
    previousScoutGroup: string;
    volunteeringInterest: string;
    additionalInformation: string;
    informationConfirmed: boolean;
    contactConsent: boolean;
};

export const joinEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const joinPhonePattern = /^[\d +()\-]{7,20}$/;

export type WaitingListEntry = Pick<JoinApplication,
    "childFirstName" | "childLastName" | "dateOfBirth" | "parentName" | "relationship" |
    "mobileNumber" | "emailAddress" | "section">;

export async function addWaitingListEntry(entry: WaitingListEntry, requestId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

    const applicationId = "leader-" + requestId;
    const applicationRef = doc(db, "joinApplications", applicationId);
    const receiptRef = doc(db, "adminUsers", user.uid, "waitingListSubmissions", applicationId);

    await runTransaction(db, async (transaction) => {
        if ((await transaction.get(receiptRef)).exists()) return;
        transaction.set(applicationRef, {
            childFirstName: cleanText(entry.childFirstName, 80),
            childLastName: cleanText(entry.childLastName, 80),
            dateOfBirth: entry.dateOfBirth,
            parentName: cleanText(entry.parentName, 150),
            relationship: cleanText(entry.relationship, 80),
            mobileNumber: entry.mobileNumber.trim(),
            emailAddress: entry.emailAddress.trim().toLowerCase(),
            section: entry.section,
            status: "waiting-list",
            source: "leader",
            createdBy: user.uid,
            submittedAt: serverTimestamp()
        });
        transaction.set(receiptRef, { submittedAt: serverTimestamp() });
    });
}

const cleanText = (
    value: string,
    maximumLength: number
): string => value.trim().slice(0, maximumLength);

export async function submitJoinApplication(
    application: JoinApplication
): Promise<string> {
    const documentReference = await addDoc(
        collection(db, "joinApplications"),
        {
            childFirstName: cleanText(application.childFirstName, 80),
            childLastName: cleanText(application.childLastName, 80),
            dateOfBirth: application.dateOfBirth,
            school: cleanText(application.school, 150),
            parentName: cleanText(application.parentName, 150),
            relationship: cleanText(application.relationship, 80),
            mobileNumber: cleanText(application.mobileNumber, 40),
            emailAddress: cleanText(
                application.emailAddress,
                254
            ).toLowerCase(),
            section: cleanText(application.section, 40),
            previousScoutExperience: cleanText(
                application.previousScoutExperience,
                10
            ),
            previousScoutGroup: cleanText(
                application.previousScoutGroup,
                150
            ),
            volunteeringInterest: cleanText(
                application.volunteeringInterest,
                20
            ),
            additionalInformation: cleanText(
                application.additionalInformation,
                1500
            ),
            informationConfirmed: application.informationConfirmed,
            contactConsent: application.contactConsent,
            status: "new",
            source: "website",
            submittedAt: serverTimestamp()
        }
    );

    try {
        await notifyJoinApplication(documentReference.id, application);
    } catch (emailError) {
        // The application is already safely stored in Firestore. Email failure must
        // not make the parent think their application was lost or resubmit it.
        reportSecondaryFailure(emailError, { area: "joinApplications", operation: "Unable to send Join Us admin email notification" });
    }

    return documentReference.id;
}