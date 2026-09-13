import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

const pendingParent = {
  uid: "parent-1",
  email: "parent@example.com",
  displayName: "Test Parent",
  mobileNumber: "0870000000",
  status: "pending",
  memberIds: [],
  linkedSections: [],
  requestedChildren: [{ firstName: "Riley", lastName: "Nolan", dateOfBirth: "2017-03-02" }],
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};

test("parent can create only a pending account with no linked members", async () => {
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(db, "parentAccounts/parent-1"), pendingParent));
  await assertFails(setDoc(doc(db, "parentAccounts/parent-bad"), { ...pendingParent, uid: "parent-bad" }));
});

test("parent cannot self-approve or assign arbitrary member IDs", async () => {
  await seed([["parentAccounts/parent-1", { ...pendingParent, createdAt: new Date(), updatedAt: new Date() }]]);
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertFails(updateDoc(doc(db, "parentAccounts/parent-1"), { status: "approved", memberIds: ["member-secret"], linkedSections: ["Cubs"] }));
  await assertFails(updateDoc(doc(db, "parentAccounts/parent-1"), { requestedChildren: [{ firstName: "Other", lastName: "Child", dateOfBirth: "2015-01-01" }] }));
});

test("pending parent cannot read candidate or enumerate arbitrary member access", async () => {
  await seed([
    ["parentAccounts/parent-1", { ...pendingParent, createdAt: new Date(), updatedAt: new Date() }],
    ["members/member-riley", { section: "Beavers", firstName: "Riley", lastName: "Nolan", dateOfBirth: "2017-03-02", displayName: "Riley Nolan" }],
  ]);
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertFails(getDoc(doc(db, "members/member-riley")));
});

test("authorised admin approval grants only the explicitly linked authoritative member", async () => {
  await seed([
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["parentAccounts/parent-1", { ...pendingParent, createdAt: new Date(), updatedAt: new Date() }],
    ["members/member-riley", { section: "Beavers", displayName: "Riley Nolan" }],
    ["members/member-other", { section: "Beavers", displayName: "Other Child" }],
  ]);
  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
  await assertSucceeds(updateDoc(doc(adminDb, "parentAccounts/parent-1"), { status: "approved", memberIds: ["member-riley"], linkedSections: ["Beavers"], reviewedBy: "admin-1", reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  const parentDb = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(parentDb, "members/member-riley")));
  await assertFails(getDoc(doc(parentDb, "members/member-other")));
});

test("rejection and later revocation do not expose member records", async () => {
  await seed([
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["parentAccounts/parent-1", { ...pendingParent, createdAt: new Date(), updatedAt: new Date() }],
    ["members/member-riley", { section: "Beavers", displayName: "Riley Nolan" }],
  ]);
  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
  await assertSucceeds(updateDoc(doc(adminDb, "parentAccounts/parent-1"), { status: "rejected", memberIds: [], linkedSections: [], reviewedBy: "admin-1", reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  let parentDb = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertFails(getDoc(doc(parentDb, "members/member-riley")));
  await seed([["parentAccounts/parent-1", { ...pendingParent, status: "approved", memberIds: ["member-riley"], linkedSections: ["Beavers"], createdAt: new Date(), updatedAt: new Date() }]]);
  await assertSucceeds(updateDoc(doc(adminDb, "parentAccounts/parent-1"), { status: "revoked", memberIds: [], linkedSections: [], reviewedBy: "admin-1", reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  parentDb = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertFails(getDoc(doc(parentDb, "members/member-riley")));
});
