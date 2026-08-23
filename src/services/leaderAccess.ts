import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { SystemRole } from "../components/admin/AdminAuthProvider";
import { normalizeLeaderRole, normalizeLeaderSections } from "./leaderAccessLogic";
import { loadInternalOrganisation, syncOrganisationLeader } from "./organisationChart";

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
    const [snapshot, organisation] = await Promise.all([
        getDocs(collection(db, "adminUsers")),
        loadInternalOrganisation().catch(() => [])
    ]);
    const byUid = new Map(organisation.map((item) => [item.uid, item]));
    return snapshot.docs.map((item) => {
        const data = item.data();
        const role: SystemRole = normalizeLeaderRole(data.role);
        const sections = normalizeLeaderSections(data);
        const org = byUid.get(item.id);
        return {
            uid: item.id,
            displayName: typeof data.displayName === "string" ? data.displayName : "Leader",
            email: typeof data.email === "string" ? data.email : "",
            role,
            active: data.active === true,
            sections,
            scoutingRole: org?.scoutingRole || "Leader",
            organisationSection: org?.organisationSection || sections[0] || "Group",
            organisationOrder: org?.organisationOrder ?? 999,
            reportsToUid: org?.reportsToUid || "",
            showPublicly: role === "leader" && org?.showPublicly === true
        };
    });
}

export async function updateLeaderAccess(record: LeaderAccessRecord, actorUid: string): Promise<void> {
    if (record.role !== "super-admin") {
        await updateDoc(doc(db, "adminUsers", record.uid), {
            role: record.role,
            sections: record.sections,
            section: record.sections[0] || "",
            active: record.active,
            updatedAt: serverTimestamp(),
            updatedBy: actorUid
        });
    }
    await syncOrganisationLeader({
        uid: record.uid,
        displayName: record.displayName,
        scoutingRole: record.scoutingRole,
        organisationSection: record.organisationSection,
        organisationOrder: record.organisationOrder,
        reportsToUid: record.reportsToUid,
        showPublicly: record.role === "leader" && record.showPublicly,
        active: record.active
    });
}
