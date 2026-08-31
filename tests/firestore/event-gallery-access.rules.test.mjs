import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seedDocuments(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const [path, data] of entries) await setDoc(doc(context.firestore(), path), data);
  });
}

function galleryEvent(section = "Cubs", status = "completed") {
  return {
    eventId: "event-1",
    title: "Camp gallery",
    description: "Safe parent-facing event summary.",
    eventType: "Camp",
    section,
    location: "Scout Den",
    startDate: "2026-08-20",
    endDate: "2026-08-22",
    status,
    updatedAt: "test",
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

test("parents cannot forge or read event gallery access projections", async () => {
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  const projection = doc(db, "eventGalleryAccess/event-1/parents/parent-1");
  await assertFails(setDoc(projection, {
    eventId: "event-1",
    section: "Cubs",
    parentUid: "parent-1",
    memberId: "member-1",
    consentApplicationId: "consent-1",
    active: true,
  }));
  await assertFails(getDoc(projection));
});

test("leaders cannot forge event gallery access projections", async () => {
  await seedDocuments([["adminUsers/leader-cubs", {
    active: true,
    role: "leader",
    sections: ["Cubs"],
  }]]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  await assertFails(setDoc(doc(db, "eventGalleryAccess/event-1/parents/parent-1"), {
    eventId: "event-1",
    section: "Cubs",
    parentUid: "parent-1",
    memberId: "member-1",
    consentApplicationId: "consent-1",
    active: true,
  }));
});

test("approved parents can read retained gallery event metadata only for linked sections", async () => {
  await seedDocuments([
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-1"], linkedSections: ["Cubs"] }],
    ["parentGalleryEvents/event-1", galleryEvent("Cubs", "completed")],
    ["parentGalleryEvents/event-2", { ...galleryEvent("Scouts", "completed"), eventId: "event-2" }],
  ]);
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();

  await assertSucceeds(getDoc(doc(db, "parentGalleryEvents/event-1")));
  await assertFails(getDoc(doc(db, "parentGalleryEvents/event-2")));
  const snapshot = await assertSucceeds(getDocs(query(collection(db, "parentGalleryEvents"), where("section", "==", "Cubs"))));
  if (snapshot.size !== 1) throw new Error(`Expected one Cubs gallery event projection, received ${snapshot.size}.`);
});

test("pending parents cannot read retained gallery event metadata", async () => {
  await seedDocuments([
    ["parentAccounts/parent-pending", { status: "pending", memberIds: [], linkedSections: [] }],
    ["parentGalleryEvents/event-1", galleryEvent()],
  ]);
  const db = testEnv.authenticatedContext("parent-pending").firestore();
  await assertFails(getDoc(doc(db, "parentGalleryEvents/event-1")));
});

test("section leaders can maintain only canonical non-draft gallery event projections", async () => {
  await seedDocuments([["adminUsers/leader-cubs", {
    active: true,
    role: "leader",
    sections: ["Cubs"],
  }]]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  const projection = doc(db, "parentGalleryEvents/event-1");

  await assertSucceeds(setDoc(projection, galleryEvent("Cubs", "closed")));
  await assertFails(setDoc(doc(db, "parentGalleryEvents/event-2"), { ...galleryEvent("Scouts", "completed"), eventId: "event-2" }));
  await assertFails(setDoc(doc(db, "parentGalleryEvents/event-3"), { ...galleryEvent("Cubs", "draft"), eventId: "event-3" }));
  await assertFails(setDoc(doc(db, "parentGalleryEvents/event-4"), { ...galleryEvent("Cubs", "completed"), eventId: "event-4", leaderNotes: "must not leak" }));
});
