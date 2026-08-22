import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
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

export async function loadInternalOrganisation(): Promise<OrganisationLeader[]> {
  const snapshot = await getDocs(collection(db, "adminUsers"));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      uid: item.id,
      displayName: text(data.displayName) || "Leader",
      scoutingRole: text(data.scoutingRole) || "Leader",
      organisationSection: text(data.organisationSection) || (Array.isArray(data.sections) && typeof data.sections[0] === "string" ? data.sections[0] : "Group"),
      organisationOrder: order(data.organisationOrder),
      reportsToUid: text(data.reportsToUid),
      showPublicly: data.showPublicly === true,
      active: data.active === true
    };
  }).filter((leader) => leader.active).sort((a, b) => a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));
}

export async function loadPublicOrganisation(): Promise<OrganisationLeader[]> {
  const snapshot = await getDocs(collection(db, "publicLeadership"));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      uid: item.id,
      displayName: text(data.displayName) || "Leader",
      scoutingRole: text(data.scoutingRole) || "Leader",
      organisationSection: text(data.organisationSection) || "Group",
      organisationOrder: order(data.organisationOrder),
      reportsToUid: text(data.reportsToUid),
      showPublicly: true,
      active: true
    };
  }).sort((a, b) => a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));
}

export async function syncPublicLeader(leader: OrganisationLeader): Promise<void> {
  const ref = doc(db, "publicLeadership", leader.uid);
  if (!leader.showPublicly || !leader.active) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, {
    displayName: leader.displayName.trim().slice(0, 120),
    scoutingRole: leader.scoutingRole.trim().slice(0, 120),
    organisationSection: leader.organisationSection.trim().slice(0, 80),
    organisationOrder: Math.max(0, Math.min(999, Math.round(leader.organisationOrder))),
    reportsToUid: leader.reportsToUid.trim().slice(0, 128),
    updatedAt: serverTimestamp()
  });
}
