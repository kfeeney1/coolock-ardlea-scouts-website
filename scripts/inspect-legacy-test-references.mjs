import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const targets = [
  ["parentAccounts", "JiS7guwrOugCLOm8Oifb8XKEKCI3"],
  ["parentAccounts", "qZ1tiX9lp3YoS59fdGwTYQcmDTg1"],
  ["publicEvents", "TEST_event_beaver_zoo"],
  ["publicEvents", "TEST_event_cub_camp"],
  ["eventConsentLinks", "d62b834df6384fb18533883fe91ff1b0"]
];

for (const [collection, id] of targets) {
  const snap = await db.collection(collection).doc(id).get();
  if (!snap.exists) {
    console.log(`${collection}/${id}: missing`);
    continue;
  }
  const data = snap.data() || {};
  const safe = {
    testData: data.testData,
    testSeed: data.testSeed,
    createdBySeed: data.createdBySeed,
    testRoleType: data.testRoleType,
    source: data.source,
    status: data.status,
    eventId: data.eventId,
    token: data.token,
    section: data.section,
    memberIds: Array.isArray(data.memberIds) ? data.memberIds : undefined,
    linkedSections: Array.isArray(data.linkedSections) ? data.linkedSections : undefined,
    uidMatchesDocument: typeof data.uid === "string" ? data.uid === id : undefined,
    hasEmail: typeof data.email === "string" && data.email.trim().length > 0,
    hasDisplayName: typeof data.displayName === "string" && data.displayName.trim().length > 0,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined
  };
  console.log(`${collection}/${id}: ${JSON.stringify(safe)}`);
}
