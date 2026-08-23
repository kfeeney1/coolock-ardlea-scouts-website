import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

async function migrateExact(collection, id, field, legacyValue, currentValue) {
  const ref = db.collection(collection).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error(`${collection}/${id} does not exist.`);
  const actual = snapshot.data()?.[field];
  if (actual === currentValue) {
    console.log(`${collection}/${id}: already current (${field}=${JSON.stringify(currentValue)}).`);
    return;
  }
  if (actual !== legacyValue) {
    throw new Error(`${collection}/${id}: refusing to change ${field}; expected legacy ${JSON.stringify(legacyValue)} but found ${JSON.stringify(actual)}.`);
  }
  await ref.update({ [field]: currentValue, updatedAt: FieldValue.serverTimestamp(), migratedBy: "firestore-compatibility-2026-08" });
  console.log(`${collection}/${id}: ${field} ${JSON.stringify(legacyValue)} -> ${JSON.stringify(currentValue)}.`);
}

await migrateExact("organisationLeadership", "TEST_uid_leader_only_01", "scoutingRole", "Scout Section Leader", "Scout Programme Scouter");
await migrateExact("organisationLeadership", "TEST_uid_leader_parent_01", "scoutingRole", "Beaver Section Leader", "Beaver Programme Scouter");
await migrateExact("joinApplications", "TEST_join_waiting_01", "status", "waiting", "waiting-list");

console.log("Guarded Firestore compatibility repair complete.");
