import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { getMetadata, listAll, ref, uploadBytes } from "firebase/storage";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seedDocuments(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

async function uploadGalleryPhoto(section, eventId) {
  await seedDocuments([["adminUsers/leader-gallery", { active: true, role: "leader", sections: [section] }]]);
  const storage = testEnv.authenticatedContext("leader-gallery", { email: "leader@example.com" }).storage();
  const photo = ref(storage, `attachments/event-gallery/${section}/${eventId}/photo-1/photo.jpg`);
  await assertSucceeds(uploadBytes(photo, new Uint8Array([1, 2, 3]), {
    contentType: "image/jpeg",
    customMetadata: {
      ownerType: "event-gallery",
      ownerId: eventId,
      section,
      uploadedBy: "leader-gallery",
      originalFileName: "photo.jpg",
    },
  }));
  return photo.fullPath;
}

function eligibleAccessDocuments({ parentUid = "parent-1", memberId = "member-1", section = "Cubs", eventId = "event-1", photoConsent = "Yes", active = true } = {}) {
  return [
    [`parentAccounts/${parentUid}`, { status: "approved", memberIds: [memberId], linkedSections: [section] }],
    [`events/${eventId}`, { section, startDate: "2026-09-12", attendance: { [memberId]: "attending" } }],
    [
      `consentApplications/consent-1`,
      { formType: "youth-activity-consent", status: "active", memberId, section, photoConsent, consentFrom: "2026-09-01", consentTo: "2026-09-30" },
    ],
    [
      `eventGalleryAccess/${eventId}/parents/${parentUid}`,
      { active, parentUid, eventId, section, memberId, consentApplicationId: "consent-1" },
    ],
  ];
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: await readFile("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});

after(async () => testEnv.cleanup());

test("approved parent can read and list only an eligible event gallery", async () => {
  const path = await uploadGalleryPhoto("Cubs", "event-1");
  await seedDocuments(eligibleAccessDocuments());
  const storage = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).storage();
  await assertSucceeds(getMetadata(ref(storage, path)));
  await assertSucceeds(listAll(ref(storage, "attachments/event-gallery/Cubs/event-1")));
  await assertFails(listAll(ref(storage, "attachments/event-gallery/Cubs")));
});

test("photo consent withdrawal immediately removes parent gallery access", async () => {
  const path = await uploadGalleryPhoto("Cubs", "event-1");
  await seedDocuments(eligibleAccessDocuments({ photoConsent: "No" }));
  const storage = testEnv.authenticatedContext("parent-1").storage();
  await assertFails(getMetadata(ref(storage, path)));
  await assertFails(listAll(ref(storage, "attachments/event-gallery/Cubs/event-1")));
});

test("revoked projection immediately removes parent gallery access", async () => {
  const path = await uploadGalleryPhoto("Cubs", "event-1");
  await seedDocuments(eligibleAccessDocuments({ active: false }));
  await assertFails(getMetadata(ref(testEnv.authenticatedContext("parent-1").storage(), path)));
});

test("missing gallery access projection fails closed for exact parent list and object reads", async () => {
  const path = await uploadGalleryPhoto("Cubs", "event-1");
  const documents = eligibleAccessDocuments();
  await seedDocuments(documents.slice(0, 3));
  const storage = testEnv.authenticatedContext("parent-1").storage();
  await assertFails(listAll(ref(storage, "attachments/event-gallery/Cubs/event-1")));
  await assertFails(getMetadata(ref(storage, path)));
});

test("malformed gallery access projection fails closed without granting list access", async () => {
  await uploadGalleryPhoto("Cubs", "event-1");
  const documents = eligibleAccessDocuments();
  documents[3][1] = {
    active: true,
    parentUid: "parent-1",
    section: "Cubs",
    memberId: "member-1",
  };
  await seedDocuments(documents);
  const storage = testEnv.authenticatedContext("parent-1").storage();
  await assertFails(listAll(ref(storage, "attachments/event-gallery/Cubs/event-1")));
});

test("projection is isolated by family, event attendance and section", async () => {
  const cubPath = await uploadGalleryPhoto("Cubs", "event-1");
  const scoutPath = await uploadGalleryPhoto("Scouts", "event-2");
  await seedDocuments([
    ...eligibleAccessDocuments(),
    ["parentAccounts/parent-2", { status: "approved", memberIds: ["member-2"], linkedSections: ["Cubs"] }],
  ]);
  const parent1 = testEnv.authenticatedContext("parent-1").storage();
  const parent2 = testEnv.authenticatedContext("parent-2").storage();
  await assertSucceeds(getMetadata(ref(parent1, cubPath)));
  await assertFails(getMetadata(ref(parent1, scoutPath)));
  await assertFails(getMetadata(ref(parent2, cubPath)));

  await seedDocuments([["events/event-1", { section: "Cubs", startDate: "2026-09-12", attendance: { "member-1": "not-attending" } }]]);
  await assertFails(getMetadata(ref(parent1, cubPath)));
});

test("unapproved parents and unauthenticated users remain denied", async () => {
  const path = await uploadGalleryPhoto("Cubs", "event-1");
  const documents = eligibleAccessDocuments({ parentUid: "parent-pending" });
  documents[0][1].status = "pending";
  await seedDocuments(documents);
  await assertFails(getMetadata(ref(testEnv.authenticatedContext("parent-pending").storage(), path)));
  await assertFails(getMetadata(ref(testEnv.unauthenticatedContext().storage(), path)));
});
