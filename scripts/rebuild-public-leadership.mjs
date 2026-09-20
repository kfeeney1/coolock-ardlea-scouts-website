import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireFirebaseMutationTarget } from "./firebase-operation-guard.mjs";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
const execute = process.argv.includes("--execute");
const environment = String(process.env.DEPLOY_ENVIRONMENT || process.env.VITE_APP_ENV || "").trim();
const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
if (!environment || !projectId) {
  throw new Error("Explicit DEPLOY_ENVIRONMENT/VITE_APP_ENV and FIREBASE_PROJECT_ID are required.");
}
const credentialProjectId = String(JSON.parse(rawCredentials)?.project_id || "").trim();
if (!credentialProjectId || credentialProjectId !== projectId) {
  throw new Error("Service-account project_id must exactly match FIREBASE_PROJECT_ID.");
}
if (execute) {
  requireFirebaseMutationTarget({
    operation: "rebuild-public-leadership",
    credentialJson: rawCredentials,
    allowProduction: true,
  });
}

initializeApp({ credential: cert(JSON.parse(rawCredentials)), projectId });
const db = getFirestore();
const PUBLIC_PROJECTION_VERSION = 2;


const [organisationSnapshot, adminSnapshot, existingPublicSnapshot] = await Promise.all([
  db.collection("organisationLeadership").get(),
  db.collection("adminUsers").get(),
  db.collection("publicLeadership").get()
]);

const adminByUid = new Map(adminSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const desired = new Map();
const rejected = [];

for (const doc of organisationSnapshot.docs) {
  const source = doc.data();
  const access = adminByUid.get(doc.id);
  if (!access || access.active !== true) continue;
  if (source.active !== true || source.showPublicly !== true) continue;
  const publicAppointments = publicAppointmentsFor(source, access);
  if (publicAppointments.length === 0) continue;

  if (!text(source.displayName) || !text(source.scoutingRole) || !text(source.organisationSection)) {
    rejected.push(`${doc.id}: missing required public organisation fields`);
    continue;
  }
  if (typeof source.organisationOrder !== "number" || !Number.isFinite(source.organisationOrder)) {
    rejected.push(`${doc.id}: invalid organisationOrder`);
    continue;
  }

  const testMarker = source.testData === true
    ? { testData: true, testSeed: source.testSeed, createdBySeed: "TEST_SEED" }
    : {};

  const primaryPublicAppointment = publicAppointments[0];
  desired.set(doc.id, {
    displayName: text(source.displayName),
    scoutingRole: primaryPublicAppointment.role,
    organisationSection: primaryPublicAppointment.section,
    organisationSections: [...new Set(publicAppointments.map((item) => item.section))],
    publicAppointments,
    organisationOrder: source.organisationOrder,
    reportsToUid: text(source.reportsToUid),
    showPublicly: true,
    active: true,
    sourceAccessRole: "leader",
    publicProjectionVersion: PUBLIC_PROJECTION_VERSION,
    ...testMarker,
    updatedAt: FieldValue.serverTimestamp()
  });
}

if (rejected.length) {
  throw new Error(`Refusing to rebuild publicLeadership from malformed canonical/proven records:\n${rejected.join("\n")}`);
}

console.log(`${execute ? "Executing" : "Dry-run"} publicLeadership rebuild.`);
console.log(`Would remove ${existingPublicSnapshot.size} existing public record(s).`);
console.log(`Would publish ${desired.size} eligible leader record(s) with projection v${PUBLIC_PROJECTION_VERSION}.`);
if (!execute) {
  console.log("Dry-run complete. Re-run with --execute after reviewing counts and target.");
  process.exit(0);
}

const batch = db.batch();
for (const doc of existingPublicSnapshot.docs) batch.delete(doc.ref);
for (const [uid, record] of desired) batch.set(db.collection("publicLeadership").doc(uid), record);
await batch.commit();

console.log("Rebuilt publicLeadership from active, explicitly public organisation records with eligible Scouting appointments.");
console.log(`Removed ${existingPublicSnapshot.size} existing public record(s).`);
console.log(`Published ${desired.size} eligible leader record(s) with projection v${PUBLIC_PROJECTION_VERSION}.`);
