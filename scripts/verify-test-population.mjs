import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();
const TEST_SEED = "comprehensive-population-v2";
const SECTIONS = [
  { section: "Beavers", key: "beaver" },
  { section: "Cubs", key: "cub" },
  { section: "Scouts", key: "scout" },
  { section: "Ventures", key: "venture" },
  { section: "Rovers", key: "rover" }
];
const GROUP_ROLE_KEYS = ["group_leader", "group_chairperson", "group_secretary", "group_treasurer", "group_quartermaster", "group_youth_champion"];
const GROUP_ROLES = new Set(["Group Leader", "Group Chairperson", "Group Secretary", "Group Treasurer", "Group Quartermaster / Bo'sun", "Group Youth Champion"]);
const SECTION_ROLE_KEYS = ["section_leader", "assistant_section_leader", "programme_scouter", "scouter"];
const SECTION_ROLES = new Set(["Section Leader", "Assistant Section Leader", "Programme Scouter", "Scouter"]);

function fail(message) { throw new Error(`Test population verification failed: ${message}`); }
async function seededDocs(name) {
  const snapshot = await db.collection(name).where("testSeed", "==", TEST_SEED).get();
  return snapshot.docs;
}

const members = await seededDocs("members");
if (members.length !== 150) fail(`expected 150 members, found ${members.length}`);
for (const { section } of SECTIONS) {
  const sectionDocs = members.filter((doc) => doc.data().section === section);
  if (sectionDocs.length !== 30) fail(`expected 30 ${section} members, found ${sectionDocs.length}`);
}
if (new Set(members.map((doc) => doc.data().displayName)).size !== 150) fail("member display names are not unique");

const adminUsers = await seededDocs("adminUsers");
if (adminUsers.length !== 28) fail(`expected 28 leader/admin profiles, found ${adminUsers.length}`);
const organisation = await seededDocs("organisationLeadership");
if (organisation.length !== 28) fail(`expected 28 organisation records, found ${organisation.length}`);
const publicLeadership = await seededDocs("publicLeadership");
if (publicLeadership.length !== 26) fail(`expected 26 public leadership records, found ${publicLeadership.length}`);

const publicGroup = publicLeadership.filter((doc) => doc.data().organisationSection === "Group");
if (publicGroup.length !== 6) fail(`expected 6 public Group executive records, found ${publicGroup.length}`);
for (const role of GROUP_ROLES) if (!publicGroup.some((doc) => doc.data().scoutingRole === role)) fail(`Group Who's Who is missing ${role}`);
for (const doc of publicGroup) if (!GROUP_ROLES.has(doc.data().scoutingRole)) fail(`unexpected public Group role ${doc.data().scoutingRole}`);

for (const { section } of SECTIONS) {
  const sectionDocs = publicLeadership.filter((doc) => doc.data().organisationSection === section);
  if (sectionDocs.length !== 4) fail(`expected 4 public ${section} leadership records, found ${sectionDocs.length}`);
  const roles = new Set(sectionDocs.map((doc) => doc.data().scoutingRole));
  for (const role of SECTION_ROLES) if (!roles.has(role)) fail(`${section} is missing public role ${role}`);
}

for (const uid of ["TEST_uid_admin_01", "TEST_uid_super_admin_01"]) {
  if (publicLeadership.some((doc) => doc.id === uid)) fail(`${uid} is present in publicLeadership`);
  const profile = adminUsers.find((doc) => doc.id === uid);
  if (!profile) fail(`${uid} admin profile is missing`);
  if (!new Set(["admin", "super-admin"]).has(profile.data().role)) fail(`${uid} has unexpected access role`);
}

const parents = await seededDocs("parentAccounts");
if (parents.length !== 15) fail(`expected 15 parent accounts, found ${parents.length}`);
if (parents.filter((doc) => doc.data().testRoleType === "parent-leader").length !== 5) fail("expected one parent+leader account per section");
if (parents.filter((doc) => doc.data().testRoleType === "parent-only").length !== 10) fail("expected two parent-only accounts per section");

const expectedAuthUids = new Set([
  ...GROUP_ROLE_KEYS.map((key) => `TEST_uid_${key}`),
  ...SECTIONS.flatMap(({ key }) => SECTION_ROLE_KEYS.map((roleKey) => `TEST_uid_${key}_${roleKey}`)),
  ...SECTIONS.flatMap(({ key }) => [1, 2].map((number) => `TEST_uid_${key}_parent_${number}`)),
  "TEST_uid_admin_01",
  "TEST_uid_super_admin_01"
]);
if (expectedAuthUids.size !== 38) fail(`internal verifier expected UID set is ${expectedAuthUids.size}, not 38`);

const missingAuthUids = [];
for (const uid of expectedAuthUids) {
  try { await auth.getUser(uid); }
  catch (error) { if (error?.code === "auth/user-not-found") missingAuthUids.push(uid); else throw error; }
}
if (missingAuthUids.length) fail(`missing comprehensive Auth users: ${missingAuthUids.join(", ")}`);

console.log("Comprehensive TEST population verified successfully.");
console.log("- Members: 150 total, exactly 30 in each youth section");
console.log("- Who's Who: every Group executive option + Section Leader / Assistant Section Leader / Programme Scouter / Scouter in every youth section");
console.log("- Parent accounts: 10 parent-only + 5 parent+leader");
console.log("- Leader/admin profiles: 26 leaders + 2 private website admins");
console.log("- Firebase Auth: all 38 comprehensive identities present");
