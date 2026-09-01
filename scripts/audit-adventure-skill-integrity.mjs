import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { adventureSkills } from "../src/data/adventureSkills/index.ts";
import { adventureCatalogueContract, validateAdventureIntegrity } from "./firestore-adventure-integrity.mjs";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const [memberSnapshot, weeklySnapshot, eventSnapshot, requirementSnapshot, awardSnapshot] = await Promise.all([
  db.collection("members").get(),
  db.collection("weeklyMeetings").get(),
  db.collection("events").get(),
  db.collectionGroup("requirements").get(),
  db.collectionGroup("awards").get()
]);

function nestedRecords(snapshot, nestedCollection) {
  return snapshot.docs
    .filter((document) => document.ref.parent.id === nestedCollection && document.ref.parent.parent?.parent?.id === "memberAdventureSkillProgress")
    .map((document) => ({ id: document.id, memberId: document.ref.parent.parent.id, path: document.ref.path, data: document.data() }));
}

const requirements = nestedRecords(requirementSnapshot, "requirements");
const awards = nestedRecords(awardSnapshot, "awards");
const errors = validateAdventureIntegrity({
  members: new Map(memberSnapshot.docs.map((document) => [document.id, document.data()])),
  weeklyMeetings: new Map(weeklySnapshot.docs.map((document) => [document.id, document.data()])),
  events: new Map(eventSnapshot.docs.map((document) => [document.id, document.data()])),
  requirements,
  awards,
  catalogue: adventureCatalogueContract(adventureSkills)
});

console.log(`Adventure Skills integrity summary: members=${memberSnapshot.size}, requirements=${requirements.length}, awards=${awards.length}.`);
if (errors.length) {
  console.error(`Adventure Skills integrity audit failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Adventure Skills nested progress matches the canonical catalogue and source-link contracts.");

