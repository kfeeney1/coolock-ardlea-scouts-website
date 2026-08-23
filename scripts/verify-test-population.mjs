import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();
const TEST_SEED = "comprehensive-population-v2";
const SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const GROUP_ROLES = new Set([
  "Group Leader",
  "Group Chairperson",
  "Group Secretary",
  "Group Treasurer",
  "Group Quartermaster / Bo'sun",
  "Group Youth Champion"
]);
const SECTION_ROLES = new Set(["Section Leader", "Assistant Section Leader", "Programme Scouter", "Scouter"]);

function fail(message) { throw new Error(`Test population verification failed: ${message}`); }
async function seededDocs(name) {
  const snapshot = await db.collection(name).where("testSeed", "==", TEST_SEED).get();
  return snapshot.docs;
}

const members = await seededDocs("members");
if (members.length !== 150) fail(`expected 150 members, found ${members.length}`);
for (const section of SECTIONS) {
  const count = members.filter((doc) => doc.data().section === section).length;
  if (count !== 30) fail(`expected 30 ${section} members, found ${count}`);
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
for (const doc of publicGroup) if (!GROUP_ROLES.has(doc.data().scoutingRole)) fail(`unexpected public Group role ${doc.data().scoutingRole}`);

for (const section of SECTIONS) {
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

let nextPageToken;
const testAuthUids = [];
do {
  const page = await auth.listUsers(1000, nextPageToken);
  testAuthUids.push(...page.users.filter((user) => user.uid.startsWith("TEST_")).map((user) => user.uid));
  nextPageToken = page.pageToken;
} while (nextPageToken);
if (testAuthUids.length !== 38) fail(`expected 38 TEST_ Auth users, found ${testAuthUids.length}`);

console.log("Comprehensive TEST population verified successfully.");
console.log("- Members: 150 total, 30 in each youth section");
console.log("- Public leadership: 6 Group executives + 20 section leaders/scouters");
console.log("- Parent accounts: 10 parent-only + 5 parent+leader");
console.log("- Leader/admin profiles: 26 leaders + 2 private website admins");
console.log("- Firebase Auth: 38 TEST_ users");
