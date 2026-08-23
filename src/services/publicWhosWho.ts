import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { isAllowedPublicAppointment } from "./publicWhosWhoLogic";

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
