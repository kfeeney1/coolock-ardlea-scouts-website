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

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function order(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 999;
}

function mapOrganisation(snapshot: QuerySnapshot<DocumentData>): OrganisationLeader[] {
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        uid: item.id,
        displayName: text(data.displayName) || "Leader",
        scoutingRole: text(data.scoutingRole) || "Leader",
        organisationSection: text(data.organisationSection) || "Group",
        organisationOrder: order(data.organisationOrder),
        reportsToUid: text(data.reportsToUid),
        showPublicly: data.showPublicly === true,
        active: data.active !== false
      };
    })
    .filter((leader) => leader.active)
    .sort(
      (a, b) =>
        a.organisationOrder - b.organisationOrder ||
        a.displayName.localeCompare(b.displayName)
    );
}

export async function loadInternalOrganisation(): Promise<OrganisationLeader[]> {
  try {
    return mapOrganisation(await getDocs(collection(db, "organisationLeadership")));
  } catch (error) {
    console.warn("Internal organisation chart read failed; falling back to public-safe hierarchy.", error);
    return loadPublicOrganisation();
  }
}

export async function loadPublicOrganisation(): Promise<OrganisationLeader[]> {
  return mapOrganisation(await getDocs(collection(db, "publicLeadership")));
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
  if (!leader.showPublicly) {
    await deleteDoc(publicRef);
    return;
  }

  await setDoc(publicRef, {
    displayName: safe.displayName,
    scoutingRole: safe.scoutingRole,
    organisationSection: safe.organisationSection,
    organisationOrder: safe.organisationOrder,
    reportsToUid: safe.reportsToUid,
    active: true,
    updatedAt: serverTimestamp()
  });
}
