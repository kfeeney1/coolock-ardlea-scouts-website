import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { isAllowedPublicAppointment, isCurrentPublicProjection } from "./publicWhosWhoLogic";

export type PublicWhosWhoLeader = {
  uid: string;
  displayName: string;
  scoutingRole: string;
  organisationSection: string;
  organisationOrder: number;
  reportsToUid: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
      if (!isCurrentPublicProjection(data) || !displayName || !isAllowedPublicAppointment(scoutingRole, organisationSection)) return null;
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
