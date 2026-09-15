import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, getMetadata, ref, uploadBytes } from "firebase/storage";

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-coolock-ardlea-scouts";
let testEnv;

async function seedDocuments(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const [path, data] of entries) await setDoc(doc(context.firestore(), path), data);
  });
}

function policyRef(storage, audience = "public", documentId = "policy-1", versionId = "v1") {
  return ref(storage, `attachments/policy-documents/current/${audience}/${documentId}/${versionId}/policy.pdf`);
}

function policyMetadata(uid, audience = "public", documentId = "policy-1", versionId = "v1") {
  return {
    contentType: "application/pdf",
    customMetadata: {
      ownerType: "policy-document",
      documentId,
      versionId,
      title: "Synthetic policy",
      description: "Rules test fixture",
      category: "governance",
      audience,
      effectiveDate: "2026-09-15",
      sourceOwner: "Synthetic test",
      state: "current",
      publishedBy: uid,
      publishedAt: "2026-09-15T10:00:00.000Z",
      originalFileName: "policy.pdf",
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

test("attachments/policy-documents allows public reads but denies anonymous restricted reads", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(policyRef(context.storage(), "public"), new Uint8Array([1]), policyMetadata("admin", "public"));
    await uploadBytes(policyRef(context.storage(), "leader", "policy-2"), new Uint8Array([1]), policyMetadata("admin", "leader", "policy-2"));
  });
  const storage = testEnv.unauthenticatedContext().storage();
  await assertSucceeds(getMetadata(policyRef(storage, "public")));
  await assertFails(getMetadata(policyRef(storage, "leader", "policy-2")));
});

test("attachments/policy-documents respects parent and leader audience boundaries", async () => {
  await seedDocuments([
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-1"], linkedSections: ["Cubs"] }],
    ["adminUsers/leader-1", { active: true, role: "leader", sections: ["Cubs"] }],
  ]);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(policyRef(context.storage(), "parent", "parent-policy"), new Uint8Array([1]), policyMetadata("admin", "parent", "parent-policy"));
    await uploadBytes(policyRef(context.storage(), "leader", "leader-policy"), new Uint8Array([1]), policyMetadata("admin", "leader", "leader-policy"));
  });
  const parent = testEnv.authenticatedContext("parent-1").storage();
  const leader = testEnv.authenticatedContext("leader-1").storage();
  await assertSucceeds(getMetadata(policyRef(parent, "parent", "parent-policy")));
  await assertFails(getMetadata(policyRef(parent, "leader", "leader-policy")));
  await assertSucceeds(getMetadata(policyRef(leader, "leader", "leader-policy")));
  await assertFails(getMetadata(policyRef(leader, "parent", "parent-policy")));
});

test("attachments/policy-documents publication is manager-only and immutable", async () => {
  await seedDocuments([
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/leader-1", { active: true, role: "leader", sections: ["Cubs"] }],
  ]);
  const admin = testEnv.authenticatedContext("admin-1").storage();
  const leader = testEnv.authenticatedContext("leader-1").storage();
  const adminPolicy = policyRef(admin, "authenticated", "managed-policy");
  await assertSucceeds(uploadBytes(adminPolicy, new Uint8Array([1, 2]), policyMetadata("admin-1", "authenticated", "managed-policy")));
  await assertFails(uploadBytes(adminPolicy, new Uint8Array([3]), policyMetadata("admin-1", "authenticated", "managed-policy")));
  await assertFails(uploadBytes(policyRef(leader, "leader", "unauthorised-policy"), new Uint8Array([1]), policyMetadata("leader-1", "leader", "unauthorised-policy")));
  await assertSucceeds(deleteObject(adminPolicy));
});

test("attachments/policy-documents rejects malformed publication metadata", async () => {
  await seedDocuments([["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }]]);
  const storage = testEnv.authenticatedContext("admin-1").storage();
  await assertFails(uploadBytes(policyRef(storage), new Uint8Array([1]), { ...policyMetadata("admin-1"), contentType: "text/plain" }));
  await assertFails(uploadBytes(policyRef(storage, "public", "policy-1", "v2"), new Uint8Array([1]), policyMetadata("admin-1", "public", "policy-1", "wrong-version")));
});
