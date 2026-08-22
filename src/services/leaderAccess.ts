import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { SystemRole } from "../components/admin/AdminAuthProvider";
import { normalizeLeaderRole, normalizeLeaderSections } from "./leaderAccessLogic";
import { syncOrganisationLeader } from "./organisationChart";

export type LeaderAccessRecord = {
    uid: string;
    displayName: string;
    email: string;
    role: SystemRole;
    active: boolean;
    sections: string[];
    scoutingRole: string;
    organisationSection: string;
    organisationOrder: number;
    reportsToUid: string;
    showPublicly: boolean;
};

export async function loadLeaderAccessRecords(): Promise<LeaderAccessRecord[]> {
    const snapshot = await getDocs(collection(db, "adminUsers"));
    return snapshot.docs.map((item) => {
        const data = item.data();
        const role: SystemRole = normalizeLeaderRole(data.role);
        const sections = normalizeLeaderSections(data);
        return {
            uid: item.id,
            displayName: typeof data.displayName === "string" ? data.displayName : "Leader",
            email: typeof data.email === "string" ? data.email : "",
            role,
            active: data.active === true,
            sections,
            scoutingRole: typeof data.scoutingRole === "string" ? data.scoutingRole : "Leader",
            organisationSection: typeof data.organisationSection === "string" ? data.organisationSection : (sections[0] || "Group"),
            organisationOrder: typeof data.organisationOrder === "number" ? data.organisationOrder : 999,
            reportsToUid: typeof data.reportsToUid === "string" ? data.reportsToUid : "",
            showPublicly: data.showPublicly === true
        };
    });
}

export async function updateLeaderAccess(record: LeaderAccessRecord, actorUid: string): Promise<void> {
    await updateDoc(doc(db, "adminUsers", record.uid), {
        role: record.role,
        sections: record.sections,
        active: record.active,
        scoutingRole: record.scoutingRole.trim().slice(0, 120),
        organisationSection: record.organisationSection.trim().slice(0, 80),
        organisationOrder: Math.max(0, Math.min(999, Math.round(record.organisationOrder))),
        reportsToUid: record.reportsToUid,
        showPublicly: record.showPublicly,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid
    });
    await syncOrganisationLeader({
        uid: record.uid,
        displayName: record.displayName,
        scoutingRole: record.scoutingRole,
        organisationSection: record.organisationSection,
        organisationOrder: record.organisationOrder,
        reportsToUid: record.reportsToUid,
        showPublicly: record.showPublicly,
        active: record.active
    });
}
