import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { requireFirebaseMutationTarget } from "./firebase-operation-guard.mjs";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

const target = requireFirebaseMutationTarget({
  operation: "verify-test-family-scenarios",
  credentialJson: rawCredentials,
});
if (target.environment !== "test" || target.projectId !== "coolock-ardlea-scouts-test") {
  throw new Error("Sibling family scenario verification may only target coolock-ardlea-scouts-test.");
}

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();
const TEST_SEED = "test-family-scenarios-v1";
const expected = [
  { key: "two", label: "2-Sibling Family", size: 2, section: "Beavers" },
  { key: "three", label: "3-Sibling Family", size: 3, section: "Cubs" },
  { key: "four", label: "4-Sibling Family", size: 4, section: "Scouts" },
];

function fail(message) { throw new Error(`TEST family scenario verification failed: ${message}`); }

const memberSnapshot = await db.collection("members").where("testSeed", "==", TEST_SEED).get();
const parentSnapshot = await db.collection("parentAccounts").where("testSeed", "==", TEST_SEED).get();

if (memberSnapshot.size !== 9) fail(`expected 9 scenario members, found ${memberSnapshot.size}`);
if (parentSnapshot.size !== 3) fail(`expected 3 scenario parent accounts, found ${parentSnapshot.size}`);

for (const scenario of expected) {
  const uid = `TEST_uid_family_${scenario.key}`;
  const expectedIds = Array.from(
    { length: scenario.size },
    (_, index) => `TEST_family_${scenario.key}_member_${String(index + 1).padStart(2, "0")}`,
  );
  const parent = parentSnapshot.docs.find((doc) => doc.id === uid);
  if (!parent) fail(`missing ${scenario.label} parent account`);
  const parentData = parent.data();
  if (parentData.testData !== true || parentData.createdBySeed !== "TEST_SEED") fail(`${uid} is missing TEST safety markers`);
  if (parentData.testFamilyType !== scenario.label) fail(`${uid} has the wrong family label`);
  if (JSON.stringify(parentData.memberIds) !== JSON.stringify(expectedIds)) fail(`${uid} does not link exactly ${scenario.size} sibling members`);
  if (JSON.stringify(parentData.linkedSections) !== JSON.stringify([scenario.section])) fail(`${uid} has the wrong section`);

  for (const id of expectedIds) {
    const member = memberSnapshot.docs.find((doc) => doc.id === id);
    if (!member) fail(`missing ${id}`);
    const data = member.data();
    if (data.siblingGroupSize !== scenario.size || data.testFamilyType !== scenario.label) fail(`${id} has the wrong sibling scenario metadata`);
    if (data.section !== scenario.section || data.status !== "active") fail(`${id} has the wrong section/status`);
    if (!String(data.displayName || "").includes(scenario.label)) fail(`${id} does not visibly identify its scenario`);
  }

  try {
    const authUser = await auth.getUser(uid);
    if (authUser.email !== `test.family.${scenario.key}@example.com`) fail(`${uid} has the wrong Auth email`);
  } catch (error) {
    if (error?.code === "auth/user-not-found") fail(`missing Auth user ${uid}`);
    throw error;
  }
}

console.log("TEST sibling-family scenarios verified successfully.");
console.log("- 2 siblings: Beavers");
console.log("- 3 siblings: Cubs");
console.log("- 4 siblings: Scouts");
console.log("- All scenario records are synthetic, stable-ID and TEST-marked");
