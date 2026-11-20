import {
    collection, doc, getDocFromServer, getDocsFromServer, query, where,
    type DocumentData, type QueryDocumentSnapshot
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserFacingError } from "./applicationErrors";
import { normalizeLeaderSections } from "./leaderAccessLogic";
import { canonicalMemberSection, loadMembers } from "./memberAdmin";
import { memberSectionStorageAliases } from "./memberSectionCore.mjs";

type ConsentDocument = { id: string; section: string; data: DocumentData };

function toRecord(id: string, data: DocumentData, sections: ReadonlyMap<string, string>): ConsentDocument {
    const currentSection = data.formType === "youth-activity-consent" ? sections.get(data.memberId) : undefined;
    const submittedSection = typeof data.section === "string" ? data.section : "";
    return { id, section: currentSection || submittedSection, data };
}

async function loadScopedDocuments(sections: string[], memberIds: string[]) {
    const applications = collection(db, "consentApplications");
    const aliases = [...new Set(sections.flatMap(section => memberSectionStorageAliases(section)))];
    const reads = aliases.flatMap(section => [
        query(applications, where("section", "==", section), where("formType", "==", "scouter-es3-medical-advice")),
        query(applications, where("section", "==", section), where("memberId", "==", ""))
    ]);
    // Budget one member lookup per candidate plus the caller's profile.
    for (let offset = 0; offset < memberIds.length; offset += 8) {
        reads.push(query(applications, where("memberId", "in", memberIds.slice(offset, offset + 8))));
    }
    const documents = new Map<string, QueryDocumentSnapshot>();
    for (let offset = 0; offset < reads.length; offset += 8) {
        const snapshots = await Promise.all(reads.slice(offset, offset + 8).map(read => getDocsFromServer(read)));
        snapshots.forEach(snapshot => snapshot.docs.forEach(item => documents.set(item.id, item)));
    }
    return [...documents.values()];
}

export async function readLeaderConsent(consentId?: string): Promise<ConsentDocument[]> {
    const user = auth.currentUser;
    if (!user) throw new UserFacingError("An active leader account is required.");
    const profile = (await getDocFromServer(doc(db, "adminUsers", user.uid))).data();
    if (profile?.active !== true) throw new UserFacingError("An active leader account is required.");
    const applications = collection(db, "consentApplications");
    if (consentId !== undefined) {
        const snapshot = await getDocFromServer(doc(applications, consentId));
        if (!snapshot.exists()) return [];
        const data = snapshot.data();
        const sections = new Map<string, string>();
        if (data.formType === "youth-activity-consent" && typeof data.memberId === "string" && data.memberId && !data.memberId.includes("/")) {
            const member = await getDocFromServer(doc(db, "members", data.memberId));
            sections.set(data.memberId, canonicalMemberSection(member.data()?.section));
        }
        return [toRecord(snapshot.id, data, sections)];
    }

    const members = await loadMembers();
    const scopes = normalizeLeaderSections(profile);
    const sections = new Map(members
        .filter(member => scopes.some(scope => member.section === scope || member.sections.includes(scope))
            || profile.role === "admin" || profile.role === "super-admin")
        .map(member => [member.id, member.section]));
    const admin = profile.role === "admin" || profile.role === "super-admin";
    const documents = admin
        ? (await getDocsFromServer(applications)).docs
        : await loadScopedDocuments(scopes, [...sections.keys()]);
    return documents.map(snapshot => toRecord(snapshot.id, snapshot.data(), sections));
}
