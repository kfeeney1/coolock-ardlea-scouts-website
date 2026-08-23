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

function isAllowedPublicAppointment(role: string, section: string): boolean {
  const sectionKey = section.toLowerCase().trim();
  if (YOUTH_SECTIONS.has(sectionKey)) return role.trim().length > 0;
  return sectionKey === "group" && GROUP_ROLES.has(roleKey(role));
}

export async function getPublicWhosWho(): Promise<PublicWhosWhoLeader[]> {
  const snapshot = await getDocs(collection(db, "publicLeadership"));
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        uid: item.id,
        displayName: text(data.displayName),
        scoutingRole: text(data.scoutingRole),
        organisationSection: text(data.organisationSection),
        organisationOrder: typeof data.organisationOrder === "number" ? data.organisationOrder : 999,
        reportsToUid: text(data.reportsToUid),
        active: data.active === true,
        showPublicly: data.showPublicly === true
      };
    })
    .filter((leader) =>
      leader.active &&
      leader.showPublicly &&
      leader.displayName.length > 0 &&
      isAllowedPublicAppointment(leader.scoutingRole, leader.organisationSection)
    )
    .map(({ active: _active, showPublicly: _showPublicly, ...leader }) => leader)
    .sort((a, b) => a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));
}
