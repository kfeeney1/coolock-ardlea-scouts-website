import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { isAllowedPublicAppointment, isCurrentPublicProjection } from "./publicWhosWhoLogic";

export type PublicWhosWhoLeader = {
  uid: string;
  displayName: string;
  scoutingRole: string;
  organisationSection: string;
  organisationSections: string[];
  organisationOrder: number;
  reportsToUid: string;
  publicAppointments: Array<{ role: string; section: string }>;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function publicAppointments(value: unknown, scoutingRole: string, primarySection: string): Array<{ role: string; section: string }> {
  const source = Array.isArray(value) ? value : [];
  const result: Array<{ role: string; section: string }> = [];
  const seen = new Set<string>();
  for (const raw of source) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const role = text(item.role);
    const section = text(item.section);
    if (!role || !section || !isAllowedPublicAppointment(role, section)) continue;
    const key = `${role.toLowerCase()}\u0000${section.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ role, section });
    }
  }
  if (result.length === 0 && isAllowedPublicAppointment(scoutingRole, primarySection)) {
    result.push({ role: scoutingRole, section: primarySection });
  }
  return result;
}

function publicSections(value: unknown, scoutingRole: string, primarySection: string): string[] {
  const candidates = Array.isArray(value) ? value.map(text) : [];
  const sections = [primarySection, ...candidates]
    .filter(Boolean)
    .filter((section) => isAllowedPublicAppointment(scoutingRole, section));
  return [...new Set(sections)];
}

export async function getPublicWhosWho(): Promise<PublicWhosWhoLeader[]> {
  const publicQuery = query(
    collection(db, "publicLeadership"),
    where("publicProjectionVersion", "==", 2),
    where("sourceAccessRole", "==", "leader"),
    where("active", "==", true),
    where("showPublicly", "==", true)
  );
  const snapshot = await getDocs(publicQuery);
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      const displayName = text(data.displayName);
      const scoutingRole = text(data.scoutingRole);
      const organisationSection = text(data.organisationSection);
      const appointments = publicAppointments(data.publicAppointments, scoutingRole, organisationSection);
      if (!isCurrentPublicProjection(data) || !displayName || appointments.length === 0) return null;
      return {
        uid: item.id,
        displayName,
        scoutingRole,
        organisationSection,
        organisationSections: [...new Set([...publicSections(data.organisationSections, scoutingRole, organisationSection), ...appointments.map((item) => item.section)])],
        publicAppointments: appointments,
        organisationOrder: typeof data.organisationOrder === "number" ? data.organisationOrder : 999,
        reportsToUid: text(data.reportsToUid)
      } satisfies PublicWhosWhoLeader;
    })
    .filter((leader): leader is PublicWhosWhoLeader => leader !== null)
    .sort((a, b) => a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));
}
