import { HttpsError } from "firebase-functions/v2/https";
import { groupMember } from "./access.js";
export async function requireMaintenance(db, request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to access Maintenance.");
  if (!await groupMember(db, request.auth.uid)) throw new HttpsError("permission-denied", "Maintenance is restricted to this Scout group's members.");
  if ((await db.doc("siteSettings/maintenanceExperience").get()).data()?.version !== "redesigned") throw new HttpsError("failed-precondition", "Maintenance is currently disabled.");
  return request.auth.uid;
}
