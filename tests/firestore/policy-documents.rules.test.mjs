import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-coolock-ardlea-scouts";
let testEnv;

function metadata(uid, audience = "public", state = "current") {
  return {
    documentId: "policy-1", versionId: "v1", title: "Synthetic policy", description: "", category: "governance",
    audience, effectiveDate: "2026-09-18", sourceOwner: "Synthetic test",
    storagePath: `attachments/policy-documents/current/${audience}/policy-1/v1/policy.pdf`,
    fileName: "policy.pdf", contentType: "application/pdf", size: 1, publishedBy: uid,
    publishedAt: serverTimestamp(), state, previousVersions: [], updatedBy: uid, updatedAt: serverTimestamp(),
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

test("policy metadata is public only when current and public", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "policyDocuments/policy-1"), { ...metadata("admin"), publishedAt: new Date(), updatedAt: new Date() });
  });
  const anonymous = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonymous, "policyDocuments/policy-1")));
  await assertSucceeds(getDocs(query(collection(anonymous, "policyDocuments"), where("state", "==", "current"), where("audience", "==", "public"))));
});

test("restricted policy metadata follows parent and leader audiences", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "parentAccounts/parent-1"), { status: "approved", memberIds: ["m1"], linkedSections: ["Cubs"] });
    await setDoc(doc(context.firestore(), "adminUsers/leader-1"), { active: true, role: "leader", sections: ["Cubs"] });
    await setDoc(doc(context.firestore(), "policyDocuments/parent-policy"), { ...metadata("admin", "parent"), documentId: "parent-policy", publishedAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(context.firestore(), "policyDocuments/leader-policy"), { ...metadata("admin", "leader"), documentId: "leader-policy", publishedAt: new Date(), updatedAt: new Date() });
  });
  const parent = testEnv.authenticatedContext("parent-1").firestore();
  const leader = testEnv.authenticatedContext("leader-1").firestore();
  await assertSucceeds(getDoc(doc(parent, "policyDocuments/parent-policy")));
  await assertFails(getDoc(doc(parent, "policyDocuments/leader-policy")));
  await assertSucceeds(getDoc(doc(leader, "policyDocuments/leader-policy")));
  await assertFails(getDoc(doc(leader, "policyDocuments/parent-policy")));
});

test("only publication managers can create or withdraw policy metadata", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "adminUsers/admin-1"), { active: true, role: "admin", sections: ["Group"] });
    await setDoc(doc(context.firestore(), "adminUsers/leader-1"), { active: true, role: "leader", sections: ["Cubs"] });
  });
  const admin = testEnv.authenticatedContext("admin-1").firestore();
  const leader = testEnv.authenticatedContext("leader-1").firestore();
  await assertSucceeds(setDoc(doc(admin, "policyDocuments/policy-1"), metadata("admin-1")));
  await assertFails(setDoc(doc(leader, "policyDocuments/policy-2"), { ...metadata("leader-1"), documentId: "policy-2" }));
  await assertSucceeds(updateDoc(doc(admin, "policyDocuments/policy-1"), { state: "withdrawn", withdrawnBy: "admin-1", withdrawnAt: serverTimestamp(), updatedBy: "admin-1", updatedAt: serverTimestamp() }));
});
