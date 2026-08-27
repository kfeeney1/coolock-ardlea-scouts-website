import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const password = process.env.E2E_TEST_USER_PASSWORD;
const action = process.argv[2] || "seed";

if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
if (!["seed", "cleanup"].includes(action)) throw new Error("Usage: node scripts/seed-population-data.mjs seed|cleanup");
if (action === "seed" && (!password || password.length < 8)) throw new Error("E2E_TEST_USER_PASSWORD must be configured and contain at least 8 characters.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();
const marker = { testData: true, testSeed: "comprehensive-population-v3", createdBySeed: "TEST_SEED" };
const reviewedBy = "TEST_SEED";
const WEB_ADMIN_UID = "TEST_uid_web_admin_01";
const MEMBERS_PER_SECTION = 6;

const sections = [
  { section: "Beavers", key: "beaver", birthYear: 2019 },
  { section: "Cubs", key: "cub", birthYear: 2016 },
  { section: "Scouts", key: "scout", birthYear: 2013 },
  { section: "Ventures", key: "venture", birthYear: 2010 },
  { section: "Rovers", key: "rover", birthYear: 2007 }
];

const groupRoles = [
  { key: "group_leader", displayName: "Declan O'Connor", scoutingRole: "Group Leader", order: 1 },
  { key: "group_chairperson", displayName: "Sarah Byrne", scoutingRole: "Group Chairperson", order: 2 },
  { key: "group_secretary", displayName: "Emma Doyle", scoutingRole: "Group Secretary", order: 3 },
  { key: "group_treasurer", displayName: "Paul Kelly", scoutingRole: "Group Treasurer", order: 4 },
  { key: "group_quartermaster", displayName: "Laura Murphy", scoutingRole: "Group Quartermaster / Bo'sun", order: 5 },
  { key: "group_youth_champion", displayName: "Aoife Ryan", scoutingRole: "Group Youth Champion", order: 6 }
];

const sectionRoleTemplates = [
  { key: "section_leader", role: "Section Leader", order: 10, parentLeader: true },
  { key: "assistant_section_leader", role: "Assistant Section Leader", order: 20, parentLeader: false },
  { key: "programme_scouter", role: "Programme Scouter", order: 30, parentLeader: false },
  { key: "scouter", role: "Scouter", order: 40, parentLeader: false }
];

const firstNames = ["Alex", "Jamie", "Sam", "Charlie", "Taylor", "Jordan", "Casey", "Riley", "Morgan", "Dylan", "Avery", "Cameron", "Robin", "Hayden", "Quinn", "Mia", "Noah", "Ella", "Liam", "Sophie", "Jack", "Lucy", "Ben", "Grace", "Luke", "Anna", "Finn", "Kate", "Sean", "Emily"];
const lastNames = ["Kelly", "Murphy", "Byrne", "Ryan", "Walsh", "Doyle", "OBrien", "Nolan", "Flynn", "Reilly", "Kavanagh", "Murray", "Fitzgerald", "Dunne", "Brennan", "McCarthy", "Carroll", "Kennedy", "Lynch", "Quinn", "Moran", "Burke", "Casey", "Foley", "Hughes", "Power", "Daly", "Cullen", "Sweeney", "Keane"];

function pad(value) { return String(value).padStart(2, "0"); }
function memberId(plan, number) { return `TEST_member_${plan.key}_${pad(number)}`; }

function membersForSection(plan) {
  return Array.from({ length: MEMBERS_PER_SECTION }, (_, index) => {
    const number = index + 1;
    const firstName = firstNames[(index + plan.section.length) % firstNames.length];
    const lastName = lastNames[(index * 3 + plan.section.length) % lastNames.length];
    return {
      id: memberId(plan, number),
      firstName,
      lastName,
      displayName: `${firstName} ${lastName} ${plan.section} ${pad(number)}`,
      dateOfBirth: `${plan.birthYear}-${pad((index % 12) + 1)}-${pad(((index * 2) % 27) + 1)}`,
      section: plan.section,
      parentName: `Test ${plan.section} Parent ${pad(number)}`,
      emailAddress: `test.${plan.key}.${pad(number)}.parent@example.com`,
      mobileNumber: `0876${String(plan.section.length)}${String(number).padStart(4, "0")}`,
      emergencyContactName: `Test ${plan.section} Emergency ${pad(number)}`,
      emergencyContactPhone: `0877${String(plan.section.length)}${String(number).padStart(4, "0")}`,
      status: "active",
      source: "manual",
      sourceJoinApplicationId: "",
      createdBy: reviewedBy,
      updatedBy: reviewedBy,
      testFamilyType: "comprehensive-population"
    };
  });
}

const members = sections.flatMap(membersForSection);

function groupLeaders() {
  return groupRoles.map((entry) => ({
    uid: `TEST_uid_${entry.key}`,
    email: `test.${entry.key.replaceAll("_", ".")}@example.com`,
    displayName: entry.displayName,
    accessRole: "leader",
    sections: ["Group"],
    scoutingRole: entry.scoutingRole,
    organisationSection: "Group",
    organisationOrder: entry.order,
    reportsToUid: entry.key === "group_leader" ? "" : "TEST_uid_group_leader",
    showPublicly: true,
    kind: "group-executive"
  }));
}

function sectionLeaders() {
  return sections.flatMap((plan) => sectionRoleTemplates.map((template) => ({
    uid: `TEST_uid_${plan.key}_${template.key}`,
    email: `test.${plan.key}.${template.key.replaceAll("_", ".")}@example.com`,
    displayName: `${plan.section} ${template.role}`,
    accessRole: "leader",
    sections: [plan.section],
    scoutingRole: template.role,
    organisationSection: plan.section,
    organisationOrder: template.order,
    reportsToUid: "TEST_uid_group_leader",
    showPublicly: true,
    kind: template.parentLeader ? "parent-leader" : "leader-only",
    memberIds: template.parentLeader ? [memberId(plan, 5), memberId(plan, 6)] : []
  })));
}

function parentOnlyUsers() {
  return sections.flatMap((plan) => [1, 2].map((number) => ({
    uid: `TEST_uid_${plan.key}_parent_${number}`,
    email: `test.${plan.key}.parent${number}@example.com`,
    displayName: `${plan.section} Parent ${number}`,
    kind: "parent-only",
    section: plan.section,
    memberIds: number === 1
      ? [memberId(plan, 1), memberId(plan, 2)]
      : [memberId(plan, 3), memberId(plan, 4)]
  })));
}

const scenarioLeaders = [
  {
    uid: "TEST_uid_multi_section_leader",
    email: "test.multi.section.leader@example.com",
    displayName: "Test Multi Section Leader",
    accessRole: "leader",
    sections: ["Beavers", "Cubs"],
    scoutingRole: "Scouter",
    organisationSection: "Beavers",
    organisationOrder: 95,
    reportsToUid: "TEST_uid_group_leader",
    showPublicly: false,
    kind: "multi-section-leader"
  }
];

const privateAdminUsers = [
  {
    uid: WEB_ADMIN_UID,
    email: "test.webadmin@example.com",
    displayName: "Test Website Administrator",
    accessRole: "admin",
    sections: ["Group"],
    scoutingRole: "Group Council Administrator",
    organisationSection: "Group",
    organisationOrder: 90,
    reportsToUid: "TEST_uid_group_leader",
    showPublicly: false,
    kind: "admin"
  },
  {
    uid: "TEST_uid_super_admin_01",
    email: "test.superadmin@example.com",
    displayName: "Test Website Super Admin",
    accessRole: "super-admin",
    sections: ["Group"],
    scoutingRole: "Group Council Administrator",
    organisationSection: "Group",
    organisationOrder: 91,
    reportsToUid: "TEST_uid_group_leader",
    showPublicly: false,
    kind: "super-admin"
  }
];

const leaders = [...groupLeaders(), ...sectionLeaders(), ...scenarioLeaders, ...privateAdminUsers];
const parents = parentOnlyUsers();
const authUsers = [...leaders, ...parents];

async function upsertAuthUser(user) {
  const properties = { email: user.email, password, displayName: user.displayName, disabled: false, emailVerified: true };
  try {
    await auth.getUser(user.uid);
    await auth.updateUser(user.uid, properties);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    await auth.createUser({ uid: user.uid, ...properties });
  }
}

async function replace(collectionName, id, data) {
  await db.collection(collectionName).doc(id).set({
    ...data,
    ...marker,
    updatedAt: FieldValue.serverTimestamp()
  });
}

async function pruneSeededDocs(collectionName, expectedIds) {
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

async function deleteAllSeededDocs(collectionName) {
  const snapshot = await db.collection(collectionName).where("testSeed", "==", marker.testSeed).get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data?.testData !== true || data?.createdBySeed !== marker.createdBySeed) {
      throw new Error(`Refusing to delete ${collectionName}/${doc.id}: canonical TEST markers are incomplete.`);
    }
    await doc.ref.delete();
  }
}

async function seedMember(member) {
  const { id, ...data } = member;
  await replace("members", id, { ...data, createdAt: FieldValue.serverTimestamp() });
}

async function seedParentAccount(user) {
  await replace("parentAccounts", user.uid, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    mobileNumber: "0878000000",
    status: "approved",
    memberIds: user.memberIds,
    linkedSections: [user.section],
    reviewedBy,
    reviewedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    testRoleType: user.kind || "parent-only"
  });
}

async function seedLeader(user) {
  await replace("adminUsers", user.uid, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: user.accessRole,
    sections: user.sections,
    active: true,
    mobileNumber: "0872000000",
    testRoleType: user.kind
  });

  const organisationRecord = {
    displayName: user.displayName,
    scoutingRole: user.scoutingRole,
    organisationSection: user.organisationSection,
    organisationOrder: user.organisationOrder,
    reportsToUid: user.reportsToUid,
    showPublicly: user.showPublicly,
    active: true,
    testRoleType: user.kind
  };
  await replace("organisationLeadership", user.uid, organisationRecord);

  if (user.accessRole === "leader" && user.showPublicly) {
    await replace("publicLeadership", user.uid, {
      ...organisationRecord,
      publicProjectionVersion: 2,
      sourceAccessRole: "leader"
    });
  } else {
    await db.collection("publicLeadership").doc(user.uid).delete().catch(() => {});
  }

  if (user.kind === "parent-leader") {
    await seedParentAccount({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      section: user.organisationSection,
      memberIds: user.memberIds,
      kind: user.kind
    });
  }
}

async function seed() {
  console.log("Seeding minimal canonical TEST population for Playwright...");
  await pruneSeededDocs("members", new Set(members.map((member) => member.id)));
  for (const user of authUsers) await upsertAuthUser(user);
  for (const member of members) await seedMember(member);
  for (const leader of leaders) await seedLeader(leader);
  for (const parent of parents) await seedParentAccount(parent);

  console.log(`Seeded ${members.length} members: ${MEMBERS_PER_SECTION} per youth section.`);
  console.log(`Seeded ${groupRoles.length} Group executive roles.`);
  console.log(`Seeded ${sections.length * sectionRoleTemplates.length} section leadership roles.`);
  console.log(`Seeded ${parents.length} parent-only users and ${sections.length} parent+leader users.`);
  console.log(`Seeded ${sectionLeaders().filter((leader) => leader.kind === "leader-only").length} leader-only section users.`);
  console.log("Seeded one private multi-section leader scenario and two private website administration fixtures.");
}

async function cleanup() {
  console.log("Removing canonical comprehensive TEST population only...");
  for (const user of authUsers) {
    try { await auth.deleteUser(user.uid); } catch (error) { if (error?.code !== "auth/user-not-found") throw error; }
  }
  for (const collectionName of ["members", "adminUsers", "organisationLeadership", "publicLeadership", "parentAccounts"]) {
    await deleteAllSeededDocs(collectionName);
  }
  console.log("Canonical comprehensive TEST population cleanup complete.");
}

if (action === "seed") await seed(); else await cleanup();
