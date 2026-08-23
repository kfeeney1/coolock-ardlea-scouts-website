import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import type { DocumentData, QuerySnapshot } from "firebase/firestore";
import { SEEDED_PUBLIC_LEADERS } from "../data/seededPublicLeadership";
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

const PUBLIC_CACHE_KEY = "coolock-ardlea-public-leadership-v6";
const PUBLIC_SNAPSHOT_URL = "/public-leadership.json";
const USE_FIRESTORE_EMULATOR = Boolean(import.meta.env.VITE_FIRESTORE_EMULATOR_HOST);

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
  return role
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ");
}

function sectionKey(section: string): string {
  return section.trim().toLowerCase();
}

export function isPublicOrganisationRole(role: string, section: string): boolean {
  if (PUBLIC_SECTIONS.has(sectionKey(section))) return Boolean(roleKey(role));
  return sectionKey(section) === "group" && PUBLIC_GROUP_ROLES.has(roleKey(role));
}

function isKnownPrivilegedPublicUid(uid: string): boolean {
  const value = uid.trim().toLowerCase();
  return /(^|[_-])(super[_-]?admin|admin)([_-]|$)/.test(value);
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

function filterPublicOrganisation(leaders: OrganisationLeader[]): OrganisationLeader[] {
  return leaders.filter(
    (leader) =>
      leader.showPublicly &&
      !isKnownPrivilegedPublicUid(leader.uid) &&
      isPublicOrganisationRole(leader.scoutingRole, leader.organisationSection)
  );
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
  return sortOrganisation(snapshot.docs.map((item) => mapLeader(item.id, item.data())));
}

function mapSnapshotPayload(value: unknown): OrganisationLeader[] | null {
  if (!Array.isArray(value)) return null;
  return filterPublicOrganisation(sortOrganisation(
    value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item) && item.publicEligible === true)
      .map((item) => mapLeader(text(item.uid), item))
      .filter((leader) => leader.uid)
  ));
}

const bundledPublicLeaders = mapSnapshotPayload(SEEDED_PUBLIC_LEADERS) ?? [];

async function loadHostedPublicSnapshot(): Promise<OrganisationLeader[] | null> {
  if (typeof fetch !== "function") return null;
  try {
    const response = await fetch(`${PUBLIC_SNAPSHOT_URL}?v=8`, { cache: "no-store" });
    if (!response.ok) return null;
    return mapSnapshotPayload(await response.json());
  } catch {
    return null;
  }
}

function readPublicCache(): OrganisationLeader[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PUBLIC_CACHE_KEY);
    if (!raw) return [];
    return mapSnapshotPayload(JSON.parse(raw)) ?? [];
  } catch {
    return [];
  }
}

function writePublicCache(leaders: OrganisationLeader[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify(leaders));
  } catch {
    // Storage can be unavailable in privacy modes.
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
  if (USE_FIRESTORE_EMULATOR) {
    return filterPublicOrganisation(mapOrganisation(await getDocs(collection(db, "publicLeadership"))));
  }

  const hosted = await loadHostedPublicSnapshot();
  if (hosted && hosted.length > 0) {
    writePublicCache(hosted);
    return hosted;
  }

  if (bundledPublicLeaders.length > 0) {
    if (hosted !== null) console.warn("Hosted public organisation snapshot is empty or unverified; using bundled public hierarchy.");
    else console.warn("Hosted public organisation snapshot unavailable; using bundled public hierarchy.");
    writePublicCache(bundledPublicLeaders);
    return bundledPublicLeaders;
  }

  const cached = readPublicCache();
  if (cached.length > 0) {
    console.warn("Hosted public organisation snapshot unavailable; using cached public hierarchy.");
    return cached;
  }

  return [];
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
  if (!leader.showPublicly || isKnownPrivilegedPublicUid(leader.uid) || !isPublicOrganisationRole(safe.scoutingRole, safe.organisationSection)) {
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
