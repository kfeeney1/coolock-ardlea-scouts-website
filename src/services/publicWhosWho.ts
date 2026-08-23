import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export type PublicWhosWhoLeader = {
  uid: string;
  displayName: string;
  scoutingRole: string;
  organisationSection: string;
  organisationOrder: number;
  reportsToUid: string;
};

const GROUP_ROLES = new Set([
  "group leader",
  "group chairperson",
  "group secretary",
  "group treasurer",
  "group quartermaster",
  "group quartermaster/bo'sun",
  "group bo'sun",
  "group youth champion"
]);
const YOUTH_SECTIONS = new Set(["beavers", "cubs", "scouts", "ventures", "rovers"]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function roleKey(value: string): string {
  return value.toLowerCase().replace(/[’‘]/g, "'").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
}

export function isAllowedPublicAppointment(role: string, section: string): boolean {
  const sectionKey = section.toLowerCase().trim();
  if (YOUTH_SECTIONS.has(sectionKey)) return role.trim().length > 0;
  return sectionKey === "group" && GROUP_ROLES.has(roleKey(role));
}

export async function getPublicWhosWho(): Promise<PublicWhosWhoLeader[]> {
  const snapshot = await getDocs(collection(db, "publicLeadership"));
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      const displayName = text(data.displayName);
      const scoutingRole = text(data.scoutingRole);
      const organisationSection = text(data.organisationSection);
      const active = data.active === true;
      const showPublicly = data.showPublicly === true;
      if (!active || !showPublicly || !displayName || !isAllowedPublicAppointment(scoutingRole, organisationSection)) return null;
      return {
        uid: item.id,
        displayName,
        scoutingRole,
        organisationSection,
        organisationOrder: typeof data.organisationOrder === "number" ? data.organisationOrder : 999,
        reportsToUid: text(data.reportsToUid)
      } satisfies PublicWhosWhoLeader;
    })
    .filter((leader): leader is PublicWhosWhoLeader => leader !== null)
    .sort((a, b) => a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));
}
