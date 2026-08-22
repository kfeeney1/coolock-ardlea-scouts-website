import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const action = process.argv[2] || "seed";

if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
if (!["seed", "cleanup"].includes(action)) throw new Error("Usage: node scripts/seed-population-data.mjs seed|cleanup");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const marker = { testData: true, testSeed: "expanded-population", createdBySeed: "TEST_SEED" };

// The core seed already contains 2 Beavers, 2 Cubs and 1 Scout.
// Add only the balance so the active seeded youth population is exactly:
// 30 Beavers, 30 Cubs, 30 Scouts, 15 Ventures and 5 Rovers.
const sectionPlan = [
  { section: "Beavers", prefix: "beaver", start: 3, end: 30, birthYear: 2018 },
  { section: "Cubs", prefix: "cub", start: 3, end: 30, birthYear: 2016 },
  { section: "Scouts", prefix: "scout", start: 2, end: 30, birthYear: 2013 },
  { section: "Ventures", prefix: "venture", start: 1, end: 15, birthYear: 2010 },
  { section: "Rovers", prefix: "rover", start: 1, end: 5, birthYear: 2007 }
];

const firstNames = ["Alex", "Jamie", "Sam", "Charlie", "Taylor", "Jordan", "Casey", "Riley", "Morgan", "Dylan", "Avery", "Cameron", "Robin", "Hayden", "Quinn"];
const lastNames = ["Kelly", "Murphy", "Byrne", "Ryan", "Walsh", "Doyle", "OBrien", "Nolan", "Flynn", "Reilly", "Kavanagh", "Murray", "Fitzgerald", "Dunne", "Brennan"];

function pad(value) { return String(value).padStart(2, "0"); }

function generatedMembers() {
  const records = [];
  let serial = 100;
  for (const plan of sectionPlan) {
    for (let number = plan.start; number <= plan.end; number += 1) {
      const firstName = firstNames[(number - 1) % firstNames.length];
      const lastName = lastNames[(number + plan.section.length) % lastNames.length];
      const id = `TEST_member_${plan.prefix}_${pad(number)}`;
      const phoneSuffix = String(serial++).padStart(4, "0");
      records.push({
        id,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName} ${pad(number)}`,
        dateOfBirth: `${plan.birthYear}-${pad(((number - 1) % 12) + 1)}-${pad(((number * 3) % 27) + 1)}`,
        section: plan.section,
        parentName: `Test Parent ${plan.section} ${pad(number)}`,
        emailAddress: `test.${plan.prefix}.${pad(number)}.parent@example.com`,
        mobileNumber: `08730${phoneSuffix}`,
        emergencyContactName: `Test Emergency ${pad(number)}`,
        emergencyContactPhone: `08740${phoneSuffix}`,
        status: "active",
        source: "manual",
        testFamilyType: "expanded-population",
        createdBy: "TEST_SEED",
        updatedBy: "TEST_SEED"
      });
    }
  }
  return records;
}

// Three role=leader test profiles already exist after the normal seed/auth seed:
// Niamh Murphy, Aisling Ryan and Conor Walsh. Add 12 to make 15 leaders.
const leaderSections = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const leaders = Array.from({ length: 12 }, (_, index) => {
  const number = index + 4;
  const section = leaderSections[index % leaderSections.length];
  return {
    id: `TEST_uid_population_leader_${pad(number)}`,
    uid: `TEST_uid_population_leader_${pad(number)}`,
    email: `test.population.leader${pad(number)}@example.com`,
    displayName: `Test Leader ${pad(number)}`,
    mobileNumber: `087500${String(number).padStart(4, "0")}`,
    role: "leader",
    sections: [section],
    section,
    active: true,
    testRoleType: "population-leader"
  };
});

const members = generatedMembers();

async function upsert(collectionName, id, data) {
  await db.collection(collectionName).doc(id).set({
    ...data,
    ...marker,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function seed() {
  console.log("Seeding expanded TEST population...");
  for (const member of members) {
    const { id, ...data } = member;
    await upsert("members", id, data);
  }
  for (const leader of leaders) {
    const { id, ...data } = leader;
    await upsert("adminUsers", id, data);
  }
  console.log(`Added population members: ${members.length}`);
  console.log("Seeded active youth totals: Beavers 30, Cubs 30, Scouts 30, Ventures 15, Rovers 5.");
  console.log("Seeded role=leader total after the normal auth seed: 15.");
}

async function removeKnown(collectionName, records) {
  for (const record of records) {
    const ref = db.collection(collectionName).doc(record.id);
    const snapshot = await ref.get();
    if (!snapshot.exists) continue;
    const data = snapshot.data();
    if (data?.testData !== true || data?.testSeed !== marker.testSeed) {
      throw new Error(`Refusing to delete ${collectionName}/${record.id}: expanded-population marker is missing.`);
    }
    await ref.delete();
  }
}

async function cleanup() {
  console.log("Removing expanded TEST population only...");
  await removeKnown("members", members);
  await removeKnown("adminUsers", leaders);
  console.log("Expanded TEST population cleanup complete.");
}

if (action === "seed") await seed(); else await cleanup();
