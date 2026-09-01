import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, getMetadata, listAll, ref, uploadBytes } from "firebase/storage";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seedDocuments(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const [path, data] of entries) await setDoc(doc(context.firestore(), path), data);
  });
}

function receiptRef(storage, section = "Cubs", attachmentId = "receipt-1", fileName = "receipt.pdf") {
  return ref(storage, `attachments/finance-receipts/${section}/${attachmentId}/${fileName}`);
}

function receiptMetadata(uid, section = "Cubs", overrides = {}) {
  return {
    contentType: "application/pdf",
    customMetadata: {
      ownerType: "finance-receipt",
      section,
      uploadedBy: uid,
      originalFileName: "receipt.pdf",
      ...overrides,
    },
  };
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

test("section leaders can manage valid receipts only in assigned sections", async () => {
  await seedDocuments([["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }]]);
  const storage = testEnv.authenticatedContext("leader-cubs").storage();
  const cubReceipt = receiptRef(storage);
  const scoutReceipt = receiptRef(storage, "Scouts");

  await assertSucceeds(uploadBytes(cubReceipt, new Uint8Array([1, 2, 3]), receiptMetadata("leader-cubs")));
  await assertSucceeds(getMetadata(cubReceipt));
  await assertSucceeds(listAll(ref(storage, "attachments/finance-receipts/Cubs")));
  await assertFails(uploadBytes(scoutReceipt, new Uint8Array([1]), receiptMetadata("leader-cubs", "Scouts")));
  await assertFails(listAll(ref(storage, "attachments/finance-receipts/Scouts")));
  await assertSucceeds(deleteObject(cubReceipt));
});

test("Group Treasurer can access finance receipts across sections", async () => {
  await seedDocuments([
    ["adminUsers/treasurer", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/treasurer", { active: true, scoutingRole: "Group Treasurer" }],
  ]);
  const storage = testEnv.authenticatedContext("treasurer").storage();
  const receipt = receiptRef(storage, "Scouts", "receipt-2", "shop.jpg");
  await assertSucceeds(uploadBytes(receipt, new Uint8Array([1, 2]), {
    ...receiptMetadata("treasurer", "Scouts"),
    contentType: "image/jpeg",
  }));
  await assertSucceeds(getMetadata(receipt));
  await assertSucceeds(listAll(ref(storage, "attachments/finance-receipts/Scouts")));
});

test("receipt uploads reject invalid type, ownership metadata and empty files", async () => {
  await seedDocuments([["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }]]);
  const storage = testEnv.authenticatedContext("leader-cubs").storage();
  await assertFails(uploadBytes(receiptRef(storage, "Cubs", "bad-type", "receipt.txt"), new Uint8Array([1]), {
    ...receiptMetadata("leader-cubs"), contentType: "text/plain",
  }));
  await assertFails(uploadBytes(receiptRef(storage, "Cubs", "wrong-section"), new Uint8Array([1]), receiptMetadata("leader-cubs", "Scouts")));
  await assertFails(uploadBytes(receiptRef(storage, "Cubs", "wrong-user"), new Uint8Array([1]), receiptMetadata("someone-else")));
  await assertFails(uploadBytes(receiptRef(storage, "Cubs", "empty"), new Uint8Array([]), receiptMetadata("leader-cubs")));
});

test("receipt objects are immutable and deletion validates stored ownership metadata", async () => {
  await seedDocuments([["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }]]);
  const storage = testEnv.authenticatedContext("leader-cubs").storage();
  const receipt = receiptRef(storage);
  await assertSucceeds(uploadBytes(receipt, new Uint8Array([1]), receiptMetadata("leader-cubs")));
  await assertFails(uploadBytes(receipt, new Uint8Array([2]), receiptMetadata("leader-cubs")));

  const malformed = receiptRef(storage, "Cubs", "legacy");
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(receiptRef(context.storage(), "Cubs", "legacy"), new Uint8Array([1]), {
      contentType: "application/pdf", customMetadata: { ownerType: "other", section: "Cubs" },
    });
  });
  await assertFails(deleteObject(malformed));
});

test("parents and unauthenticated users cannot access finance receipts", async () => {
  await seedDocuments([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-1"], linkedSections: ["Cubs"] }],
  ]);
  const leaderStorage = testEnv.authenticatedContext("leader-cubs").storage();
  const path = receiptRef(leaderStorage).fullPath;
  await assertSucceeds(uploadBytes(ref(leaderStorage, path), new Uint8Array([1]), receiptMetadata("leader-cubs")));

  const parentStorage = testEnv.authenticatedContext("parent-1").storage();
  const publicStorage = testEnv.unauthenticatedContext().storage();
  await assertFails(getMetadata(ref(parentStorage, path)));
  await assertFails(listAll(ref(parentStorage, "attachments/finance-receipts/Cubs")));
  await assertFails(getMetadata(ref(publicStorage, path)));
});
