import { collection, getDocs } from "firebase/firestore";

import { db } from "../firebase";
import { validateOperationalIntegrity } from "../../scripts/firestore-operational-integrity.mjs";
import { summariseOperationalDataHealth, type OperationalDataHealth } from "./operationalHealth";

const COLLECTIONS = [
  "members", "parentAccounts", "weeklyMeetings", "events", "eventConsentLinks", "eventConsentResponses", "consentApplications",
  "equipmentCategories", "equipmentLocations", "equipmentItems", "equipmentLoans", "equipmentIncidents", "equipmentHistory",
  "equipmentProgrammeRequirements", "financeTransactions", "financeReconciliations"
] as const;

export async function loadOperationalDataHealth(): Promise<OperationalDataHealth> {
  const snapshots = await Promise.all(COLLECTIONS.map(async (name) => [name, await getDocs(collection(db, name))] as const));
  const records = new Map(snapshots.map(([name, snapshot]) => [
    name,
    new Map(snapshot.docs.map((document) => [document.id, document.data()]))
  ]));
  return summariseOperationalDataHealth(validateOperationalIntegrity(records), COLLECTIONS.length);
}
