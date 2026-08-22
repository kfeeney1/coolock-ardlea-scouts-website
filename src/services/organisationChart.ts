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

const PUBLIC_CACHE_KEY = "coolock-ardlea-public-leadership-v1";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function order(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 999;
}

function sortOrganisation(leaders: OrganisationLeader[]): OrganisationLeader[] {
  return leaders
    .filter((leader) => leader.active)
    .sort(
      (a, b) =>
        a.organisationOrder - b.organisationOrder ||
        a.displayName.localeCompare(b.displayName)
    );
}

function mapOrganisation(snapshot: QuerySnapshot<DocumentData>): OrganisationLeader[] {
  return sortOrganisation(
    snapshot.docs.map((item) => {
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
  );
}

function readPublicCache(): OrganisationLeader[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PUBLIC_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortOrganisation(
      parsed.filter((item): item is OrganisationLeader =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof item.uid === "string" &&
        typeof item.displayName === "string" &&
        typeof item.scoutingRole === "string" &&
        typeof item.organisationSection === "string"
      )
    );
  } catch {
    return [];
  }
}

function writePublicCache(leaders: OrganisationLeader[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify(leaders));
  } catch {
    // Storage can be unavailable in privacy modes; Firestore remains the source of truth.
  }
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
  try {
    const leaders = mapOrganisation(await getDocs(collection(db, "publicLeadership")));
    writePublicCache(leaders);
    return leaders;
  } catch (error) {
    const cached = readPublicCache();
    if (cached.length > 0) {
      console.warn("Public organisation read failed; using cached public hierarchy.", error);
      return cached;
    }
    throw error;
  }
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
