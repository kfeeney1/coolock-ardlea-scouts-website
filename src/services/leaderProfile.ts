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
        section:
            typeof data.section === "string"
                ? data.section
                : "",
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

    await updateDoc(
        doc(
            db,
            "adminUsers",
            user.uid
        ),
        {
            displayName: clean(
                profile.displayName,
                150
            ),
            mobileNumber: clean(
                profile.mobileNumber,
                40
            ),
            section: clean(
                profile.section,
                40
            )
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
