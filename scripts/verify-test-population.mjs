import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

initializeApp({ credential: rawCredentials ? cert(JSON.parse(rawCredentials)) : applicationDefault() });
const db = getFirestore();
const auth = getAuth();
const TEST_SEED = "comprehensive-population-v3";
const WEB_ADMIN_UID = "TEST_uid_web_admin_01";
const SUPER_ADMIN_UID = "TEST_uid_super_admin_01";
const MODERN_SUPER_ADMIN_UID = "TEST_uid_modern_super_admin_01";
const MULTI_SECTION_UID = "TEST_uid_multi_section_leader";
const NAVIGATION_MULTI_UID = "TEST_uid_navigation_multi_appointment";
const MEMBERS_PER_SECTION = 6;
const SECTIONS = [
  { section: "Beavers", key: "beaver" },
  { section: "Cubs", key: "cub" },
  { section: "Scouts", key: "scout" },
  { section: "Ventures", key: "venture" },
  { section: "Rovers", key: "rover" }
];
const GROUP_ROLE_KEYS = ["group_leader", "deputy_group_leader", "group_chairperson", "group_secretary", "group_treasurer", "group_quartermaster", "group_youth_champion"];
const GROUP_ROLES = new Set(["Group Leader", "Deputy Group Leader", "Group Chairperson", "Group Secretary", "Group Treasurer", "Group Quartermaster / Bo'sun", "Group Youth Champion"]);
const SECTION_ROLE_KEYS = ["section_leader", "assistant_section_leader", "programme_scouter", "scouter"];
const SECTION_ROLES = new Set(["Section Leader", "Assistant Section Leader", "Programme Scouter", "Scouter"]);

function fail(message) { throw new Error(`Test population verification failed: ${message}`); }
async function seededDocs(name) {
  const snapshot = await db.collection(name).where("testSeed", "==", TEST_SEED).get();
  return snapshot.docs;
}

const expectedMemberCount = SECTIONS.length * MEMBERS_PER_SECTION;
const members = await seededDocs("members");
const roverManagementFixtureId = "TEST_member_rover_manager_cub_section_leader";
const canonicalMembers = members.filter((doc) => doc.id !== roverManagementFixtureId);
if (canonicalMembers.length !== expectedMemberCount) fail(`expected ${expectedMemberCount} canonical members, found ${canonicalMembers.length}`);
if (members.length !== expectedMemberCount + 1) fail(`expected one Rover manager fixture in addition to ${expectedMemberCount} canonical members, found ${members.length - canonicalMembers.length}`);
for (const { section } of SECTIONS) {
  const sectionDocs = canonicalMembers.filter((doc) => doc.data().section === section);
  if (sectionDocs.length !== MEMBERS_PER_SECTION) fail(`expected ${MEMBERS_PER_SECTION} ${section} members, found ${sectionDocs.length}`);
}
if (new Set(members.map((doc) => doc.data().displayName)).size !== members.length) fail("member display names are not unique");
for (const doc of canonicalMembers) {
  for (const key of ["firstName", "lastName", "displayName", "dateOfBirth", "section", "parentName", "emailAddress", "mobileNumber", "emergencyContactName", "emergencyContactPhone", "status", "source", "sourceJoinApplicationId"]) {
    if (!(key in doc.data())) fail(`members/${doc.id} missing canonical field ${key}`);
  }
  if (doc.data().status !== "active") fail(`members/${doc.id} has non-canonical seeded status`);
}
const roverManagementFixture = members.find((doc) => doc.id === roverManagementFixtureId)?.data();
if (!roverManagementFixture
  || roverManagementFixture.accountUid !== "TEST_uid_cub_section_leader"
  || roverManagementFixture.displayName !== "Cubs Section Leader"
  || roverManagementFixture.emailAddress !== "test.cub.section.leader@example.com"
  || roverManagementFixture.status !== "left"
  || roverManagementFixture.section !== "Cubs"
  || JSON.stringify(roverManagementFixture.sections) !== JSON.stringify(["Cubs"])) {
  fail("Rover manager linked-adult fixture must be a left Cubs member for the seeded Cubs Section Leader account");
}

const adminUsers = await seededDocs("adminUsers");
if (adminUsers.length !== 33) fail(`expected 33 leader/admin profiles, found ${adminUsers.length}`);
for (const doc of adminUsers) {
  const data = doc.data();
  if (!(data.role === "leader" || data.role === "admin" || data.role === "super-admin")) fail(`adminUsers/${doc.id} has invalid role`);
  if (!Array.isArray(data.sections) || data.sections.length === 0) fail(`adminUsers/${doc.id} missing canonical sections[]`);
  if ("section" in data) fail(`adminUsers/${doc.id} contains legacy section field`);
  if (data.active !== true) fail(`adminUsers/${doc.id} must be active`);
}

const organisation = await seededDocs("organisationLeadership");
if (organisation.length !== 33) fail(`expected 33 organisation records, found ${organisation.length}`);
const publicLeadership = await seededDocs("publicLeadership");
if (publicLeadership.length !== 27) fail(`expected 27 public leadership records, found ${publicLeadership.length}`);
for (const doc of publicLeadership) {
  const data = doc.data();
  if (data.publicProjectionVersion !== 2 || data.sourceAccessRole !== "leader") fail(`publicLeadership/${doc.id} is not current projection v2`);
  if (data.active !== true || data.showPublicly !== true) fail(`publicLeadership/${doc.id} is not active/public`);
}

const publicGroup = publicLeadership.filter((doc) => doc.data().organisationSection === "Group");
if (publicGroup.length !== 7) fail(`expected 7 public Group executive records, found ${publicGroup.length}`);
for (const role of GROUP_ROLES) if (!publicGroup.some((doc) => doc.data().scoutingRole === role)) fail(`Group Who's Who is missing ${role}`);
for (const doc of publicGroup) if (!GROUP_ROLES.has(doc.data().scoutingRole)) fail(`unexpected public Group role ${doc.data().scoutingRole}`);

for (const { section } of SECTIONS) {
  const sectionDocs = publicLeadership.filter((doc) => doc.data().organisationSection === section);
  if (sectionDocs.length !== 4) fail(`expected 4 public ${section} leadership records, found ${sectionDocs.length}`);
  const roles = new Set(sectionDocs.map((doc) => doc.data().scoutingRole));
  for (const role of SECTION_ROLES) if (!roles.has(role)) fail(`${section} is missing public role ${role}`);
  for (const doc of sectionDocs) if (!SECTION_ROLES.has(doc.data().scoutingRole)) fail(`${section} contains unexpected public role ${doc.data().scoutingRole}`);
}

for (const uid of [WEB_ADMIN_UID, SUPER_ADMIN_UID, MODERN_SUPER_ADMIN_UID, MULTI_SECTION_UID, NAVIGATION_MULTI_UID]) {
  if (publicLeadership.some((doc) => doc.id === uid)) fail(`${uid} is present in publicLeadership`);
}
for (const uid of [WEB_ADMIN_UID, SUPER_ADMIN_UID, MODERN_SUPER_ADMIN_UID]) {
  const profile = adminUsers.find((doc) => doc.id === uid);
  if (!profile) fail(`${uid} admin profile is missing`);
  if (!new Set(["admin", "super-admin"]).has(profile.data().role)) fail(`${uid} has unexpected access role`);
}
const modernProfile = adminUsers.find((doc) => doc.id === MODERN_SUPER_ADMIN_UID);
if (modernProfile?.data().uiTheme !== "modern") fail(`${MODERN_SUPER_ADMIN_UID} must use modern theme`);
const multiSection = adminUsers.find((doc) => doc.id === MULTI_SECTION_UID);
if (!multiSection) fail("multi-section leader fixture is missing");
if (JSON.stringify(multiSection.data().sections) !== JSON.stringify(["Beavers", "Cubs"])) fail("multi-section leader must have Beavers and Cubs");

// The permission matrix requires exactly this private identity, not an arbitrary
// extra leader that merely makes the profile count pass.
const navigationAppointments = [
  { appointment: "Group Secretary", scope: "Group", active: true },
  { appointment: "Group Quartermaster / Bo'sun", scope: "Group", active: true },
  { appointment: "Group Treasurer", scope: "Group", active: false }
];
const appointmentSignature = (value) => Array.isArray(value)
  ? value.map((item) => JSON.stringify([item?.appointment, item?.scope, item?.active])).sort().join("|")
  : "";
const navigationProfile = adminUsers.find((doc) => doc.id === NAVIGATION_MULTI_UID)?.data();
const navigationOrganisation = organisation.find((doc) => doc.id === NAVIGATION_MULTI_UID)?.data();
if (!navigationProfile || navigationProfile.role !== "leader"
  || navigationProfile.email !== "test.navigation.multi.appointment@example.com"
  || JSON.stringify(navigationProfile.sections) !== JSON.stringify(["Group"])
  || appointmentSignature(navigationProfile.appointments) !== appointmentSignature(navigationAppointments)) {
  fail("navigation multi-appointment profile must retain active Secretary/Bosun and inactive Treasurer appointments");
}
if (!navigationOrganisation || navigationOrganisation.showPublicly !== false
  || navigationOrganisation.active !== true
  || appointmentSignature(navigationOrganisation.appointments) !== appointmentSignature(navigationAppointments)) {
  fail("navigation multi-appointment organisation record must be private and retain the canonical appointments");
}

const parents = await seededDocs("parentAccounts");
if (parents.length !== 15) fail(`expected 15 parent accounts, found ${parents.length}`);
if (parents.filter((doc) => doc.data().testRoleType === "parent-leader").length !== 5) fail("expected one parent+leader account per section");
if (parents.filter((doc) => doc.data().testRoleType === "parent-only").length !== 10) fail("expected two parent-only accounts per section");
for (const doc of parents) {
  const data = doc.data();
  if (!Array.isArray(data.memberIds) || !Array.isArray(data.linkedSections)) fail(`parentAccounts/${doc.id} missing canonical arrays`);
  if (data.status !== "approved") fail(`parentAccounts/${doc.id} has unexpected status`);
}

const expectedAuthUids = new Set([
  ...GROUP_ROLE_KEYS.map((key) => `TEST_uid_${key}`),
  ...SECTIONS.flatMap(({ key }) => SECTION_ROLE_KEYS.map((roleKey) => `TEST_uid_${key}_${roleKey}`)),
  ...SECTIONS.flatMap(({ key }) => [1, 2].map((number) => `TEST_uid_${key}_parent_${number}`)),
  MULTI_SECTION_UID,
  NAVIGATION_MULTI_UID,
  WEB_ADMIN_UID,
  SUPER_ADMIN_UID,
  MODERN_SUPER_ADMIN_UID
]);
if (expectedAuthUids.size !== 42) fail(`internal verifier expected UID set is ${expectedAuthUids.size}, not 42`);

const missingAuthUids = [];
for (const uid of expectedAuthUids) {
  try { await auth.getUser(uid); }
  catch (error) { if (error?.code === "auth/user-not-found") missingAuthUids.push(uid); else throw error; }
}
if (missingAuthUids.length) fail(`missing comprehensive Auth users: ${missingAuthUids.join(", ")}`);

console.log("Minimal canonical TEST population verified successfully.");
console.log(`- Members: ${expectedMemberCount} total, exactly ${MEMBERS_PER_SECTION} in each youth section`);
console.log("- Who's Who: exactly seven Group roles + four approved section roles per youth section");
console.log("- Parent accounts: 10 parent-only + 5 parent+leader");
console.log("- Leader/admin profiles: 27 public leaders + 2 private multi-section leaders + 3 private website admins + 1 private navigation multi-appointment leader");
console.log("- Firebase Auth: all 42 canonical identities present");
