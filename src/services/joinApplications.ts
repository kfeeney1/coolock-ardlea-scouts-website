import {
    addDoc,
    collection,
    serverTimestamp
} from "firebase/firestore";

import { db } from "../firebase";
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
    emergencyContactName: string;
    emergencyContactPhone: string;
    volunteeringInterest: string;
    additionalInformation: string;
    informationConfirmed: boolean;
    contactConsent: boolean;
};

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
            emergencyContactName: cleanText(
                application.emergencyContactName,
                150
            ),
            emergencyContactPhone: cleanText(
                application.emergencyContactPhone,
                40
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
        console.error("Unable to send Join Us admin email notification:", emailError);
    }

    return documentReference.id;
}