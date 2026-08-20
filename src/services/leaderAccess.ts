import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { SystemRole } from "../components/admin/AdminAuthProvider";

export type LeaderAccessRecord = { uid: string; displayName: string; email: string; role: SystemRole; active: boolean; sections: string[]; };

export async function loadLeaderAccessRecords(): Promise<LeaderAccessRecord[]> {
    const snapshot = await getDocs(collection(db, "adminUsers"));
    return snapshot.docs.map((item) => {
        const data = item.data();
        const role: SystemRole = data.role === "super-admin" || data.role === "admin" ? data.role : "leader";
        const sections = Array.isArray(data.sections) ? data.sections.filter((v): v is string => typeof v === "string") : (typeof data.section === "string" && data.section ? [data.section] : []);
        return { uid: item.id, displayName: typeof data.displayName === "string" ? data.displayName : "Leader", email: typeof data.email === "string" ? data.email : "", role, active: data.active === true, sections };
    });
}

export async function updateLeaderAccess(uid: string, role: SystemRole, sections: string[], active: boolean, actorUid: string): Promise<void> {
    await updateDoc(doc(db, "adminUsers", uid), { role, sections, active, updatedAt: serverTimestamp(), updatedBy: actorUid });
}
