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
  await seedDocuments([["adminUsers/leader-cubs", { active: true, role: "leader", sections: [section] }]]);
  const storage = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).storage();
  const photo = ref(storage, `attachments/event-gallery/${section}/${eventId}/photo-1/photo.jpg`);
  await assertSucceeds(uploadBytes(photo, new Uint8Array([1, 2, 3]), {
    contentType: "image/jpeg",
    customMetadata: {
      ownerType: "event-gallery",
      ownerId: eventId,
      section,
      uploadedBy: "leader-cubs",
      originalFileName: "photo.jpg",
    },
  }));
  return photo.fullPath;
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

test("approved parent can read and list only an event with an active projection", async () => {
  const path = await uploadGalleryPhoto("Cubs", "event-1");
  await seedDocuments([
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-1"], linkedSections: ["Cubs"] }],
    ["galleryAccess/parent-1/events/event-1", { active: true, parentUid: "parent-1", eventId: "event-1", section: "Cubs", memberIds: ["member-1"] }],
  ]);
  const storage = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).storage();
  await assertSucceeds(getMetadata(ref(storage, path)));
  await assertSucceeds(listAll(ref(storage, "attachments/event-gallery/Cubs/event-1")));
  await assertFails(listAll(ref(storage, "attachments/event-gallery/Cubs")));
});

test("revoked projection immediately removes parent gallery access", async () => {
  const path = await uploadGalleryPhoto("Cubs", "event-1");
  await seedDocuments([
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-1"], linkedSections: ["Cubs"] }],
    ["galleryAccess/parent-1/events/event-1", { active: false, parentUid: "parent-1", eventId: "event-1", section: "Cubs", memberIds: ["member-1"] }],
  ]);
  const storage = testEnv.authenticatedContext("parent-1").storage();
  await assertFails(getMetadata(ref(storage, path)));
  await assertFails(listAll(ref(storage, "attachments/event-gallery/Cubs/event-1")));
});

test("projection is isolated by parent, event and section", async () => {
  const cubPath = await uploadGalleryPhoto("Cubs", "event-1");
  const scoutPath = await uploadGalleryPhoto("Scouts", "event-2");
  await seedDocuments([
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-1"], linkedSections: ["Cubs"] }],
    ["parentAccounts/parent-2", { status: "approved", memberIds: ["member-2"], linkedSections: ["Cubs"] }],
    ["galleryAccess/parent-1/events/event-1", { active: true, parentUid: "parent-1", eventId: "event-1", section: "Cubs", memberIds: ["member-1"] }],
  ]);
  const parent1 = testEnv.authenticatedContext("parent-1").storage();
  const parent2 = testEnv.authenticatedContext("parent-2").storage();
  await assertSucceeds(getMetadata(ref(parent1, cubPath)));
  await assertFails(getMetadata(ref(parent1, scoutPath)));
  await assertFails(getMetadata(ref(parent2, cubPath)));
});

test("unapproved parents and unauthenticated users remain denied", async () => {
  const path = await uploadGalleryPhoto("Cubs", "event-1");
  await seedDocuments([
    ["parentAccounts/parent-pending", { status: "pending", memberIds: ["member-1"], linkedSections: ["Cubs"] }],
    ["galleryAccess/parent-pending/events/event-1", { active: true, parentUid: "parent-pending", eventId: "event-1", section: "Cubs", memberIds: ["member-1"] }],
  ]);
  await assertFails(getMetadata(ref(testEnv.authenticatedContext("parent-pending").storage(), path)));
  await assertFails(getMetadata(ref(testEnv.unauthenticatedContext().storage(), path)));
});
