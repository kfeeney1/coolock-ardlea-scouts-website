import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireFirebaseMutationTarget } from "./firebase-operation-guard.mjs";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const password = process.env.E2E_TEST_USER_PASSWORD;
const action = process.argv[2] || "seed";

if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
if (!["seed", "cleanup"].includes(action)) throw new Error("Usage: node scripts/seed-test-family-scenarios.mjs seed|cleanup");
if (action === "seed" && (!password || password.length < 8)) {
  throw new Error("E2E_TEST_USER_PASSWORD must be configured and contain at least 8 characters.");
}

const target = requireFirebaseMutationTarget({
  operation: `seed-test-family-scenarios:${action}`,
  credentialJson: rawCredentials,
  requireAuthEmulator: true,
});
if (target.environment !== "test" || target.projectId !== "coolock-ardlea-scouts-test") {
  throw new Error("Sibling family scenarios are persistent TEST fixtures and may only target coolock-ardlea-scouts-test.");
}

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();
const marker = { testData: true, testSeed: "test-family-scenarios-v1", createdBySeed: "TEST_SEED" };

const scenarios = [
  { key: "two", label: "2-Sibling Family", size: 2, section: "Beavers", birthYear: 2019, phoneSuffix: "0200" },
  { key: "three", label: "3-Sibling Family", size: 3, section: "Cubs", birthYear: 2016, phoneSuffix: "0300" },
  { key: "four", label: "4-Sibling Family", size: 4, section: "Scouts", birthYear: 2013, phoneSuffix: "0400" },
];

function parentUid(scenario) { return `TEST_uid_family_${scenario.key}`; }
function parentEmail(scenario) { return `test.family.${scenario.key}@example.com`; }
function memberId(scenario, index) { return `TEST_family_${scenario.key}_member_${String(index).padStart(2, "0")}`; }
function memberIds(scenario) { return Array.from({ length: scenario.size }, (_, index) => memberId(scenario, index + 1)); }

async function upsertAuthUser(scenario) {
  const uid = parentUid(scenario);
  const properties = {
    email: parentEmail(scenario),
    password,
    displayName: `TEST ${scenario.label} Parent`,
    disabled: false,
    emailVerified: true,
  };
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, properties);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    await auth.createUser({ uid, ...properties });
  }
}

async function set(collectionName, id, data) {
  await db.collection(collectionName).doc(id).set({
    ...data,
    ...marker,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function prune(collectionName, expectedIds) {
  const snapshot = await db.collection(collectionName).where("testSeed", "==", marker.testSeed).get();
  for (const doc of snapshot.docs) {
    if (expectedIds.has(doc.id)) continue;
    const data = doc.data();
    if (data?.testData !== true || data?.createdBySeed !== marker.createdBySeed) {
      throw new Error(`Refusing to prune ${collectionName}/${doc.id}: canonical TEST markers are incomplete.`);
    }
    await doc.ref.delete();
  }
}

async function seedScenario(scenario) {
  await upsertAuthUser(scenario);
  const ids = memberIds(scenario);
  const parentName = `TEST ${scenario.label} Parent`;

  for (let offset = 0; offset < ids.length; offset += 1) {
    const number = offset + 1;
    await set("members", ids[offset], {
      firstName: `TEST ${scenario.size}-Sibling ${number}`,
      lastName: "Family",
      displayName: `TEST ${scenario.label} Member ${number}`,
      dateOfBirth: `${scenario.birthYear}-${String(number).padStart(2, "0")}-15`,
      section: scenario.section,
      parentName,
      emailAddress: parentEmail(scenario),
      mobileNumber: `0870${scenario.phoneSuffix}`,
      emergencyContactName: `TEST ${scenario.label} Emergency Contact`,
      emergencyContactPhone: `0860${scenario.phoneSuffix}`,
      status: "active",
      source: "manual",
      sourceJoinApplicationId: "",
      createdBy: "TEST_SEED",
      testFamilyType: scenario.label,
      siblingGroupSize: scenario.size,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await set("parentAccounts", parentUid(scenario), {
    uid: parentUid(scenario),
    email: parentEmail(scenario),
    displayName: parentName,
    mobileNumber: `0870${scenario.phoneSuffix}`,
    status: "approved",
    memberIds: ids,
    linkedSections: [scenario.section],
    reviewedBy: "TEST_SEED",
    reviewedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    testRoleType: "sibling-family-scenario",
    testFamilyType: scenario.label,
  });
}

async function seed() {
  const expectedMembers = new Set(scenarios.flatMap(memberIds));
  const expectedParents = new Set(scenarios.map(parentUid));
  await prune("members", expectedMembers);
  await prune("parentAccounts", expectedParents);
  for (const scenario of scenarios) await seedScenario(scenario);
  console.log("Seeded deterministic TEST sibling-family scenarios: 2, 3 and 4 siblings.");
}

async function cleanup() {
  await prune("members", new Set());
  await prune("parentAccounts", new Set());
  for (const scenario of scenarios) {
    try {
      await auth.deleteUser(parentUid(scenario));
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
  }
  console.log("Removed deterministic TEST sibling-family scenarios.");
}

if (action === "seed") await seed(); else await cleanup();
