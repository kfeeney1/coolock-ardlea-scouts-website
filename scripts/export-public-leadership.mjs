import { mkdir, writeFile } from "node:fs/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const requirePublicLeaders = String(process.env.REQUIRE_PUBLIC_LEADERS || "").toLowerCase() === "true";
const SNAPSHOT_CONTRACT_VERSION = 9;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const PUBLIC_GROUP_ROLES = new Set([
  "group leader",
  "group chairperson",
  "group secretary",
  "group treasurer",
  "group quartermaster",
  "group quartermaster/bo'sun",
  "group bo'sun",
  "group youth champion"
]);
const PUBLIC_SECTIONS = new Set(["beavers", "cubs", "scouts", "ventures", "rovers"]);

function roleKey(role) {
  return typeof role === "string"
    ? role.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ")
    : "";
}

function sectionKey(section) {
  return typeof section === "string" ? section.trim().toLowerCase() : "";
}

function isPublicOrganisationRole(role, section) {
  if (PUBLIC_SECTIONS.has(sectionKey(section))) return Boolean(roleKey(role));
  return sectionKey(section) === "group" && PUBLIC_GROUP_ROLES.has(roleKey(role));
}

function isPrivilegedAccessRole(role) {
  const value = typeof role === "string" ? role.trim().toLowerCase() : "";
  return value === "admin" || value === "super-admin";
}

const [organisationSnapshot, adminSnapshot] = await Promise.all([
  db.collection("organisationLeadership").get(),
  db.collection("adminUsers").get()
]);

const privilegedUids = new Set(
  adminSnapshot.docs
    .filter((item) => isPrivilegedAccessRole(item.data()?.role))
    .map((item) => item.id)
);

const leaders = organisationSnapshot.docs
  .map((item) => ({ uid: item.id, ...item.data() }))
  .filter((leader) =>
    leader.active !== false &&
    leader.showPublicly === true &&
    !privilegedUids.has(leader.uid) &&
    isPublicOrganisationRole(leader.scoutingRole, leader.organisationSection)
  )
  .map((leader) => ({
    uid: leader.uid,
    displayName: typeof leader.displayName === "string" ? leader.displayName.trim() : "Leader",
    scoutingRole: leader.scoutingRole.trim(),
    organisationSection: typeof leader.organisationSection === "string" ? leader.organisationSection.trim() : "Group",
    organisationOrder: typeof leader.organisationOrder === "number" ? leader.organisationOrder : 999,
    reportsToUid: typeof leader.reportsToUid === "string" ? leader.reportsToUid.trim() : "",
    showPublicly: true,
    active: true,
    publicEligible: true,
    snapshotContractVersion: SNAPSHOT_CONTRACT_VERSION
  }))
  .sort((a, b) => a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));

if (requirePublicLeaders && leaders.length === 0) {
  throw new Error("Public organisation export returned zero approved Scout Group roles.");
}

await mkdir("public", { recursive: true });
await writeFile("public/public-leadership.json", `${JSON.stringify(leaders, null, 2)}\n`, "utf8");
console.log(`Exported ${leaders.length} approved public Scout Group role(s) using snapshot contract v${SNAPSHOT_CONTRACT_VERSION}.`);
