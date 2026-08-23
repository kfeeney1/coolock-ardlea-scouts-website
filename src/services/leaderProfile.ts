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
import { normalizeLeaderRole, normalizeLeaderSections } from "./leaderAccessLogic";

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

export async function loadLeaderProfile(): Promise<LeaderProfileData> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader was found.");

    const snapshot = await getDoc(doc(db, "adminUsers", user.uid));
    if (!snapshot.exists()) throw new Error("Leader profile was not found.");

    const data = snapshot.data();
    const sections = normalizeLeaderSections(data);
    if (sections.length === 0) throw new Error("Leader profile has no canonical section assignment.");

    return {
        displayName: typeof data.displayName === "string" ? data.displayName : "",
        email: user.email ?? "",
        mobileNumber: typeof data.mobileNumber === "string" ? data.mobileNumber : "",
        section: sections[0],
        role: normalizeLeaderRole(data.role)
    };
}

export async function updateLeaderProfile(
    profile: Pick<LeaderProfileData, "displayName" | "mobileNumber" | "section">
): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader was found.");

    const profileRef = doc(db, "adminUsers", user.uid);
    const snapshot = await getDoc(profileRef);
    if (!snapshot.exists()) throw new Error("Leader profile was not found.");

    const existingSections = normalizeLeaderSections(snapshot.data());
    if (existingSections.length === 0) throw new Error("Leader profile has no canonical section assignment.");

    await updateDoc(profileRef, {
        displayName: clean(profile.displayName, 150),
        mobileNumber: clean(profile.mobileNumber, 40),
        sections: existingSections
    });
}

export async function changeLeaderPassword(
    currentPassword: string,
    newPassword: string
): Promise<void> {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("No password-based leader account was found.");

    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
}
