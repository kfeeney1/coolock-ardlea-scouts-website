import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { listAll, ref, uploadBytes } from "firebase/storage";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const [path, data] of entries) await setDoc(doc(context.firestore(), path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: await readFile("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await seed([
    ["adminUsers/dgl", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/dgl", { active: true, scoutingRole: "Deputy Group Leader" }],
    ["adminUsers/ordinary", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/ordinary", { active: true, scoutingRole: "Scouter" }]
  ]);
});

after(async () => testEnv.cleanup());

test("Deputy Group Leader can manage finance receipts across sections", async () => {
  const storage = testEnv.authenticatedContext("dgl").storage();
  const receipt = ref(storage, "attachments/finance-receipts/Scouts/dgl/receipt.pdf");
  await assertSucceeds(uploadBytes(receipt, new Uint8Array([1]), {
    contentType: "application/pdf",
    customMetadata: { ownerType: "finance-receipt", section: "Scouts", uploadedBy: "dgl" }
  }));
  await assertSucceeds(listAll(ref(storage, "attachments/finance-receipts/Scouts")));
});

test("Deputy Group Leader can manage event galleries across sections", async () => {
  const storage = testEnv.authenticatedContext("dgl").storage();
  const image = ref(storage, "attachments/event-gallery/Scouts/event-1/image-1/photo.jpg");
  await assertSucceeds(uploadBytes(image, new Uint8Array([1]), {
    contentType: "image/jpeg",
    customMetadata: { ownerType: "event-gallery", ownerId: "event-1", section: "Scouts", uploadedBy: "dgl" }
  }));
  await assertSucceeds(listAll(ref(storage, "attachments/event-gallery/Scouts")));
});

test("ordinary Group-scoped Leader does not inherit Deputy group-wide Storage grants", async () => {
  const storage = testEnv.authenticatedContext("ordinary").storage();
  const receipt = ref(storage, "attachments/finance-receipts/Scouts/ordinary/receipt.pdf");
  await assertFails(uploadBytes(receipt, new Uint8Array([1]), {
    contentType: "application/pdf",
    customMetadata: { ownerType: "finance-receipt", section: "Scouts", uploadedBy: "ordinary" }
  }));
  await assertFails(listAll(ref(storage, "attachments/event-gallery/Scouts")));
});
