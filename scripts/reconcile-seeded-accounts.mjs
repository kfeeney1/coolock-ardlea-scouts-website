import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();
const checkOnly = process.argv.includes("--check");

const SECTION_KEYS = ["beaver", "cub", "scout", "venture", "rover"];
const GROUP_ROLE_KEYS = [
  "group_leader",
  "group_chairperson",
  "group_secretary",
  "group_treasurer",
  "group_quartermaster",
  "group_youth_champion"
];
const SECTION_ROLE_KEYS = [
  "section_leader",
  "assistant_section_leader",
  "programme_scouter",
  "scouter"
];
const WEB_ADMIN_UID = "TEST_uid_web_admin_01";
const SUPER_ADMIN_UID = "TEST_uid_super_admin_01";
const MULTI_SECTION_LEADER_UID = "TEST_uid_multi_section_leader";

const leaderUids = new Set([
  ...GROUP_ROLE_KEYS.map((key) => `TEST_uid_${key}`),
  ...SECTION_KEYS.flatMap((section) => SECTION_ROLE_KEYS.map((role) => `TEST_uid_${section}_${role}`)),
  MULTI_SECTION_LEADER_UID,
  WEB_ADMIN_UID,
  SUPER_ADMIN_UID
]);
const parentOnlyUids = SECTION_KEYS.flatMap((section) => [1, 2].map((number) => `TEST_uid_${section}_parent_${number}`));
const parentLeaderUids = SECTION_KEYS.map((section) => `TEST_uid_${section}_section_leader`);
const flowParentUids = ["TEST_flow_parent_pending", "TEST_flow_parent_rejected"];
const canonicalAuthUids = new Set([...leaderUids, ...parentOnlyUids]);
const canonicalParentUids = new Set([...parentOnlyUids, ...parentLeaderUids, ...flowParentUids]);
const canonicalLeaderRequestUids = new Set([
  "TEST_flow_leader_request_pending",
  "TEST_flow_leader_request_approved",
  "TEST_flow_leader_request_rejected"
]);

function isTestId(id) {
  return typeof id === "string" && id.startsWith("TEST_");
}

async function reconcileCollection(collectionName, canonicalIds) {
  const snapshot = await db.collection(collectionName).get();
  const drift = [];
  for (const doc of snapshot.docs) {
    if (!isTestId(doc.id) || canonicalIds.has(doc.id)) continue;
    drift.push(doc.id);
    if (!checkOnly) await doc.ref.delete();
  }
  return drift;
}

async function reconcileAuth() {
  const drift = [];
  let nextPageToken;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const user of page.users) {
      if (!isTestId(user.uid) || canonicalAuthUids.has(user.uid)) continue;
      drift.push(user.uid);
      if (!checkOnly) await auth.deleteUser(user.uid);
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  return drift;
}

const results = {
  auth: await reconcileAuth(),
  adminUsers: await reconcileCollection("adminUsers", leaderUids),
  organisationLeadership: await reconcileCollection("organisationLeadership", leaderUids),
  parentAccounts: await reconcileCollection("parentAccounts", canonicalParentUids),
  leaderRegistrationRequests: await reconcileCollection("leaderRegistrationRequests", canonicalLeaderRequestUids),
  publicLeadership: await reconcileCollection("publicLeadership", leaderUids)
};

let driftTotal = 0;
for (const [area, ids] of Object.entries(results)) {
  driftTotal += ids.length;
  console.log(`${area}: ${ids.length} ${checkOnly ? "legacy test record(s) found" : "legacy test record(s) removed"}${ids.length ? ` -> ${ids.join(", ")}` : ""}`);
}

if (checkOnly) {
  console.log(`Seed account drift inspection complete. ${driftTotal} non-canonical TEST_ account/reference record(s) currently exist.`);
  console.log(`Canonical live test identities: ${canonicalAuthUids.size} Auth users, ${leaderUids.size} leader/admin records, ${canonicalParentUids.size} parent-account records.`);
  process.exit(0);
}

const verificationTargets = [
  ["adminUsers", leaderUids],
  ["organisationLeadership", leaderUids],
  ["parentAccounts", canonicalParentUids],
  ["leaderRegistrationRequests", canonicalLeaderRequestUids],
  ["publicLeadership", leaderUids]
];
for (const [collectionName, canonicalIds] of verificationTargets) {
  const snapshot = await db.collection(collectionName).get();
  const unexpected = snapshot.docs.filter((doc) => isTestId(doc.id) && !canonicalIds.has(doc.id)).map((doc) => doc.id);
  if (unexpected.length) throw new Error(`${collectionName} still contains legacy test records: ${unexpected.join(", ")}`);
}

let unexpectedAuth = [];
let verifyPageToken;
do {
  const page = await auth.listUsers(1000, verifyPageToken);
  unexpectedAuth.push(...page.users.filter((user) => isTestId(user.uid) && !canonicalAuthUids.has(user.uid)).map((user) => user.uid));
  verifyPageToken = page.pageToken;
} while (verifyPageToken);
if (unexpectedAuth.length) throw new Error(`Firebase Auth still contains legacy TEST_ users: ${unexpectedAuth.join(", ")}`);

console.log(`Seed account reconciliation complete. Removed ${driftTotal} legacy test account/reference record(s).`);
console.log(`Canonical live test identities: ${canonicalAuthUids.size} Auth users, ${leaderUids.size} leader/admin records, ${canonicalParentUids.size} parent-account records.`);