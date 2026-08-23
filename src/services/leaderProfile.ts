import {
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword
} from "firebase/auth";
import {
    doc,
    getDoc,
    updateDoc
} from "firebase/firestore";

import {
    auth,
    db
} from "../firebase";

export type LeaderProfileData = {
    displayName: string;
    email: string;
    mobileNumber: string;
    section: string;
    role: string;
};

const clean = (
    value: string,
    maxLength: number
): string => value.trim().slice(0, maxLength);

function profileSections(data: Record<string, unknown>): string[] {
    if (!Array.isArray(data.sections)) return [];
    return [...new Set(
        data.sections
            .filter((value): value is string => typeof value === "string")
            .map((value) => clean(value, 40))
            .filter(Boolean)
    )];
}

export async function loadLeaderProfile(): Promise<
    LeaderProfileData
> {
    const user = auth.currentUser;

    if (!user) {
        throw new Error(
            "No signed-in leader was found."
        );
    }

    const snapshot = await getDoc(
        doc(
            db,
            "adminUsers",
            user.uid
        )
    );

    if (!snapshot.exists()) {
        throw new Error(
            "Leader profile was not found."
        );
    }

    const data = snapshot.data();
    const sections = profileSections(data);
    const primarySection = sections[0] || (
        typeof data.section === "string"
            ? data.section
            : ""
    );

    return {
        displayName:
            typeof data.displayName === "string"
                ? data.displayName
                : "",
        email: user.email ?? "",
        mobileNumber:
            typeof data.mobileNumber === "string"
                ? data.mobileNumber
                : "",
        section: primarySection,
        role:
            typeof data.role === "string"
                ? data.role
                : "leader"
    };
}

export async function updateLeaderProfile(
    profile: Pick<
        LeaderProfileData,
        "displayName" |
        "mobileNumber" |
        "section"
    >
): Promise<void> {
    const user = auth.currentUser;

    if (!user) {
        throw new Error(
            "No signed-in leader was found."
        );
    }

    const profileRef = doc(
        db,
        "adminUsers",
        user.uid
    );
    const snapshot = await getDoc(profileRef);
    if (!snapshot.exists()) {
        throw new Error(
            "Leader profile was not found."
        );
    }

    const existingSections = profileSections(snapshot.data());
    const requestedSection = clean(profile.section, 40);
    const sections = existingSections.length > 0
        ? existingSections
        : requestedSection
            ? [requestedSection]
            : [];
    const section = sections[0] || "";

    await updateDoc(
        profileRef,
        {
            displayName: clean(
                profile.displayName,
                150
            ),
            mobileNumber: clean(
                profile.mobileNumber,
                40
            ),
            section,
            sections
        }
    );
}

export async function changeLeaderPassword(
    currentPassword: string,
    newPassword: string
): Promise<void> {
    const user = auth.currentUser;

    if (
        !user ||
        !user.email
    ) {
        throw new Error(
            "No password-based leader account was found."
        );
    }

    const credential =
        EmailAuthProvider.credential(
            user.email,
            currentPassword
        );

    await reauthenticateWithCredential(
        user,
        credential
    );

    await updatePassword(
        user,
        newPassword
    );
}
