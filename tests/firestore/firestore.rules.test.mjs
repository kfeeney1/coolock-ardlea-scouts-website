import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seedDocuments(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) {
      await setDoc(doc(db, path), data);
    }
  });
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

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

test("unauthenticated users cannot read member records", async () => {
  await seedDocuments([["members/member-cub", { section: "Cubs", displayName: "Test Cub" }]]);
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "members/member-cub")));
});

test("leaders can read only members in their assigned sections", async () => {
  await seedDocuments([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/member-cub", { section: "Cubs", displayName: "Test Cub" }],
    ["members/member-scout", { section: "Scouts", displayName: "Test Scout" }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "members/member-cub")));
  await assertFails(getDoc(doc(db, "members/member-scout")));
});

test("approved parents can read linked children but not other members", async () => {
  await seedDocuments([
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-cub"], linkedSections: ["Cubs"] }],
    ["members/member-cub", { section: "Cubs", displayName: "Linked Cub" }],
    ["members/member-other", { section: "Cubs", displayName: "Other Cub" }],
  ]);
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "members/member-cub")));
  await assertFails(getDoc(doc(db, "members/member-other")));
});

test("member lifecycle history is append-only and section scoped", async () => {
  await seedDocuments([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/member-cub", { section: "Cubs", displayName: "Test Cub", status: "active" }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  const historyRef = doc(db, "memberHistory/history-1");

  await assertSucceeds(setDoc(historyRef, {
    memberId: "member-cub",
    memberName: "Test Cub",
    changeType: "status-change",
    fromSection: "Cubs",
    toSection: "Cubs",
    fromStatus: "active",
    toStatus: "inactive",
    changedBy: "leader-cubs",
    changedAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(historyRef));
  await assertFails(updateDoc(historyRef, { toStatus: "left" }));
});

test("leaders cannot create transfer history into an unassigned section", async () => {
  await seedDocuments([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/member-cub", { section: "Cubs", displayName: "Test Cub", status: "active" }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();

  await assertFails(setDoc(doc(db, "memberHistory/history-2"), {
    memberId: "member-cub",
    memberName: "Test Cub",
    changeType: "section-transfer",
    fromSection: "Cubs",
    toSection: "Scouts",
    fromStatus: "active",
    toStatus: "active",
    changedBy: "leader-cubs",
    changedAt: serverTimestamp(),
  }));
});

test("admins can list parent accounts", async () => {
  await seedDocuments([
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["parentAccounts/parent-1", { status: "approved", memberIds: [], linkedSections: [] }],
  ]);
  const db = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
  await assertSucceeds(getDocs(collection(db, "parentAccounts")));
});

test("admins cannot promote themselves to super-admin", async () => {
  await seedDocuments([["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"], displayName: "Test Admin" }]]);
  const db = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
  await assertFails(updateDoc(doc(db, "adminUsers/admin-1"), { role: "super-admin" }));
});

test("leaders can append valid audit entries but cannot edit them", async () => {
  await seedDocuments([["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }]]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  const auditRef = doc(db, "auditLog/audit-1");

  await assertSucceeds(setDoc(auditRef, {
    category: "member",
    action: "update",
    actorUid: "leader-cubs",
    actorEmail: "leader@example.com",
    targetId: "member-cub",
    targetLabel: "Test Cub",
    description: "Updated member details",
    section: "Cubs",
    createdAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(auditRef, { description: "Rewritten history" }));
});

test("public join applications accept valid canonical submissions and reject invalid consent", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const canonical = {
    childFirstName: "Alex",
    childLastName: "Scout",
    dateOfBirth: "2016-05-10",
    parentName: "Test Parent",
    emailAddress: "parent@example.com",
    mobileNumber: "0870000000",
    emergencyContactName: "Test Emergency",
    emergencyContactPhone: "0871111111",
    section: "Cubs",
    informationConfirmed: true,
    contactConsent: true,
    status: "new",
    source: "website",
    submittedAt: serverTimestamp(),
  };

  await assertSucceeds(setDoc(doc(db, "joinApplications/valid"), canonical));
  await assertFails(setDoc(doc(db, "joinApplications/invalid"), {
    ...canonical,
    contactConsent: false,
    submittedAt: serverTimestamp(),
  }));
});

test("unknown collections remain denied by the default rule", async () => {
  const db = testEnv.authenticatedContext("someone").firestore();
  await assertFails(setDoc(doc(db, "unexpectedCollection/doc-1"), { value: true }));
});
