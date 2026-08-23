import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import type { DocumentData, QuerySnapshot } from "firebase/firestore";
import { db } from "../firebase";

export type OrganisationLeader = {
  uid: string;
  displayName: string;
  scoutingRole: string;
  organisationSection: string;
  organisationOrder: number;
  reportsToUid: string;
  showPublicly: boolean;
  active: boolean;
};

const PUBLIC_GROUP_ROLES = new Set([
  "group leader",
  "group chairperson",
  "group secretary",
  "group treasurer",
  "group quartermaster",
  "group quartermaster/bo'sun",
  "group bo'sun",
  "group youth champion"
]);
const PUBLIC_SECTIONS = new Set(["beavers", "cubs", "scouts", "ventures", "rovers"]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function order(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 999;
}

function roleKey(role: string): string {
  return role.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
}

function sectionKey(section: string): string {
  return section.trim().toLowerCase();
}

function isPublicOrganisationRole(role: string, section: string): boolean {
  if (PUBLIC_SECTIONS.has(sectionKey(section))) return Boolean(roleKey(role));
  return sectionKey(section) === "group" && PUBLIC_GROUP_ROLES.has(roleKey(role));
}

function mapLeader(uid: string, data: Record<string, unknown>): OrganisationLeader {
  return {
    uid,
    displayName: text(data.displayName) || "Leader",
    scoutingRole: text(data.scoutingRole) || "Leader",
    organisationSection: text(data.organisationSection) || "Group",
    organisationOrder: order(data.organisationOrder),
    reportsToUid: text(data.reportsToUid),
    showPublicly: data.showPublicly === true,
    active: data.active !== false
  };
}

function mapOrganisation(snapshot: QuerySnapshot<DocumentData>): OrganisationLeader[] {
  return snapshot.docs
    .map((item) => mapLeader(item.id, item.data()))
    .filter((leader) => leader.active)
    .sort((a, b) => a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));
}

export async function loadInternalOrganisation(): Promise<OrganisationLeader[]> {
  return mapOrganisation(await getDocs(collection(db, "organisationLeadership")));
}

export async function syncOrganisationLeader(leader: OrganisationLeader): Promise<void> {
  const privateRef = doc(db, "organisationLeadership", leader.uid);
  if (!leader.active) {
    await deleteDoc(privateRef);
    await deleteDoc(doc(db, "publicLeadership", leader.uid));
    return;
  }

  const safe = {
    displayName: leader.displayName.trim().slice(0, 120),
    scoutingRole: leader.scoutingRole.trim().slice(0, 120),
    organisationSection: leader.organisationSection.trim().slice(0, 80),
    organisationOrder: Math.max(0, Math.min(999, Math.round(leader.organisationOrder))),
    reportsToUid: leader.reportsToUid.trim().slice(0, 128),
    showPublicly: leader.showPublicly,
    active: true,
    updatedAt: serverTimestamp()
  };

  await setDoc(privateRef, safe);
  const publicRef = doc(db, "publicLeadership", leader.uid);
  if (!leader.showPublicly || !isPublicOrganisationRole(safe.scoutingRole, safe.organisationSection)) {
    await deleteDoc(publicRef);
    return;
  }

  await setDoc(publicRef, {
    displayName: safe.displayName,
    scoutingRole: safe.scoutingRole,
    organisationSection: safe.organisationSection,
    organisationOrder: safe.organisationOrder,
    reportsToUid: safe.reportsToUid,
    showPublicly: true,
    active: true,
    updatedAt: serverTimestamp()
  });
}
