import { FieldValue } from "firebase-admin/firestore";

/** Trusted Admin SDK writers bypass Rules. Call before changing canonical leader
 * sources so an existing snapshot cannot remain usable during or after import. */
export async function invalidateMaintenanceDirectoryForAdmin(db) {
  const ref = db.doc("maintenance/group/config/leaders");
  await db.runTransaction(async transaction => {
    if (!(await transaction.get(ref)).exists) return;
    transaction.update(ref, {generation: FieldValue.increment(1), ready: false, updatedAt: FieldValue.serverTimestamp(), updatedBy: "SYSTEM_CANONICAL_LEADER_UPDATE"});
  });
}
