import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const VALID_SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Scouter", "All Sections"]);
const AFFECTED_PARENT_IDS = [
  "1B4FSzKcsLbfovmPS27Xbhq6bQt1",
  "4ZDN8Rc37pSGgoxPR3xfZndjlGE2",
  "6ljCDJ9t8WXCnjcNHYIEa6ySN7G3",
  "IgErcywOE0QkZA3RiMhj1jyeED43",
  "JiS7guwrOugCLOm8Oifb8XKEKCI3",
  "QUUUJzmCTNMNe6MFVgkarHuYN5A2",
  "bsxEeR6QGLaCGezY4IIyl8icZjw2"
];

function stringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function deriveLinkedSections(parentId, memberIds) {
  const sections = new Set();
  for (const memberId of memberIds) {
    const member = await db.collection("members").doc(memberId).get();
    if (!member.exists) throw new Error(`parentAccounts/${parentId}: refusing repair because linked member ${memberId} does not exist.`);
    const section = member.data()?.section;
    if (typeof section !== "string" || !VALID_SECTIONS.has(section)) {
      throw new Error(`parentAccounts/${parentId}: refusing repair because linked member ${memberId} has an unsupported section.`);
    }
    sections.add(section);
  }
  return [...sections].sort();
}

for (const parentId of AFFECTED_PARENT_IDS) {
  const ref = db.collection("parentAccounts").doc(parentId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error(`parentAccounts/${parentId} does not exist.`);

  const data = snapshot.data();
  if (!stringArray(data.memberIds)) {
    throw new Error(`parentAccounts/${parentId}: refusing repair because memberIds is not an array of strings.`);
  }

  const expectedSections = await deriveLinkedSections(parentId, data.memberIds);
  const currentSections = stringArray(data.linkedSections) ? [...new Set(data.linkedSections)].sort() : null;

  if (currentSections && sameValues(currentSections, expectedSections)) {
    console.log(`parentAccounts/${parentId}: linkedSections already current.`);
    continue;
  }

  await ref.update({
    linkedSections: expectedSections,
    updatedAt: FieldValue.serverTimestamp(),
    migratedBy: "parent-linked-sections-compatibility-2026-08"
  });
  console.log(`parentAccounts/${parentId}: linkedSections repaired (${expectedSections.length} section(s)).`);
}

console.log("Guarded parent-account linkedSections repair complete.");
