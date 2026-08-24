import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import type { DocumentData, QuerySnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { isAllowedPublicAppointment, PUBLIC_PROJECTION_VERSION } from "./publicWhosWhoLogic";

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

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapLeader(uid: string, data: Record<string, unknown>): OrganisationLeader | null {
  const displayName = text(data.displayName);
  const scoutingRole = text(data.scoutingRole);
  const organisationSection = text(data.organisationSection);
  const reportsToUid = text(data.reportsToUid);
  const organisationOrder = data.organisationOrder;
  if (
    !displayName || !scoutingRole || !organisationSection ||
    typeof organisationOrder !== "number" || !Number.isFinite(organisationOrder) ||
    typeof data.showPublicly !== "boolean" || data.active !== true
  ) return null;

  return {
    uid,
    displayName,
    scoutingRole,
    organisationSection,
    organisationOrder,
    reportsToUid,
    showPublicly: data.showPublicly,
    active: true
  };
}

function mapOrganisation(snapshot: QuerySnapshot<DocumentData>): OrganisationLeader[] {
  return snapshot.docs
    .map((item) => mapLeader(item.id, item.data()))
    .filter((leader): leader is OrganisationLeader => leader !== null)
    .sort((a, b) => a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));
}

export async function loadInternalOrganisation(): Promise<OrganisationLeader[]> {
  return mapOrganisation(await getDocs(collection(db, "organisationLeadership")));
}

export async function syncOrganisationLeader(leader: OrganisationLeader): Promise<void> {
  const privateRef = doc(db, "organisationLeadership", leader.uid);
  const publicRef = doc(db, "publicLeadership", leader.uid);
  if (!leader.active) {
    await deleteDoc(privateRef);
    await deleteDoc(publicRef);
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
  if (!safe.displayName || !safe.scoutingRole || !safe.organisationSection) {
    throw new Error("Organisation leader does not match the canonical data contract.");
  }

  await setDoc(privateRef, safe);

  const accessSnapshot = await getDoc(doc(db, "adminUsers", leader.uid));
  const access = accessSnapshot.exists() ? accessSnapshot.data() : null;
  const leaderAccess = access?.role === "leader" && access?.active === true && Array.isArray(access?.sections) && access.sections.length > 0;
  if (!leaderAccess || !leader.showPublicly || !isAllowedPublicAppointment(safe.scoutingRole, safe.organisationSection)) {
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
    publicProjectionVersion: PUBLIC_PROJECTION_VERSION,
    sourceAccessRole: "leader",
    updatedAt: serverTimestamp()
  });
}
