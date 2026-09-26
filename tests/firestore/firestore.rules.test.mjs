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

test("canonical section access includes legacy Venture aliases", async () => {
  await seedDocuments([
    ["adminUsers/leader-ventures", { active: true, role: "leader", sections: ["Ventures"] }],
    ["members/member-venture", { section: "Venture Scout", displayName: "Legacy Venture" }],
  ]);
  const db = testEnv.authenticatedContext("leader-ventures", { email: "venture@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "members/member-venture")));
});

test("member name updates may persist display-name mode without widening identity fields", async () => {
  await seedDocuments([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/member-cub", { firstName: "Alex", lastName: "Old", displayName: "Alex Old", displayNameMode: "auto", dateOfBirth: "2016-01-01", section: "Cubs", status: "active" }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  await assertSucceeds(updateDoc(doc(db, "members/member-cub"), {
    lastName: "O'Neill-Smith",
    displayName: "Alex O'Neill-Smith",
    displayNameMode: "auto",
    updatedAt: serverTimestamp(),
    updatedBy: "leader-cubs",
  }));
  await assertFails(updateDoc(doc(db, "members/member-cub"), { familyId: "forged-family" }));
});

test("current-section leaders can read stable linked consent after a member transfer", async () => {
  await seedDocuments([
    ["adminUsers/leader-ventures", { active: true, role: "leader", sections: ["Ventures"] }],
    ["members/member-venture", { section: "Ventures", displayName: "Moved Venture", status: "active" }],
    ["consentApplications/historical-consent", { section: "Scouts", memberId: "member-venture", formType: "youth-activity-consent", status: "active" }],
    ["consentApplications/other-consent", { section: "Scouts", memberId: "member-other", formType: "youth-activity-consent", status: "active" }],
    ["members/member-other", { section: "Scouts", displayName: "Other Scout", status: "active" }],
  ]);
  const db = testEnv.authenticatedContext("leader-ventures", { email: "venture@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "consentApplications/historical-consent")));
  await assertFails(getDoc(doc(db, "consentApplications/other-consent")));
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

test("super-admins can scan malformed section-scoped records while ordinary leaders cannot", async () => {
  await seedDocuments([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/super-1", { active: true, role: "super-admin", sections: ["Group"] }],
    ["weeklyMeetings/malformed", { meetingDate: "2026-09-07", entries: [], injuries: [] }],
    ["members/malformed", { displayName: "Missing section" }],
    ["events/malformed", { title: "Missing section" }],
    ["eventConsentLinks/malformed", { active: false }],
    ["financeTransactions/malformed", { description: "Missing section" }],
    ["financeReconciliations/malformed", { note: "Missing section" }],
  ]);
  const leaderDb = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  const superAdminDb = testEnv.authenticatedContext("super-1", { email: "super@example.com" }).firestore();

  for (const collectionName of ["weeklyMeetings", "members", "events", "eventConsentLinks", "financeTransactions", "financeReconciliations"]) {
    await assertFails(getDocs(collection(leaderDb, collectionName)));
    await assertSucceeds(getDocs(collection(superAdminDb, collectionName)));
  }
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


test("leaderChildRelationships enforce authorised reads and canonical admin/group-leader writes", async () => {
  await seedDocuments([
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/leader-parent", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/ordinary-leader", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/treasurer", { active: true, role: "leader", sections: ["Group"], permissions: ["finance"] }],
    ["organisationLeadership/group-leader", { active: true, userId: "group-leader", role: "Group Leader" }],
    ["adminUsers/group-leader", { active: true, role: "leader", sections: ["Group"] }],
    ["members/member-cub", { section: "Cubs", displayName: "Linked Cub", status: "active" }],
  ]);

  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
  const groupLeaderDb = testEnv.authenticatedContext("group-leader", { email: "gl@example.com" }).firestore();
  const ordinaryDb = testEnv.authenticatedContext("ordinary-leader", { email: "leader@example.com" }).firestore();
  const canonicalPath = "leaderChildRelationships/leader-parent--member-cub";
  const relationship = {
    leaderUid: "leader-parent",
    memberId: "member-cub",
    active: true,
    createdBy: "admin-1",
    createdAt: serverTimestamp(),
    updatedBy: "admin-1",
    updatedAt: serverTimestamp(),
  };

  await assertSucceeds(setDoc(doc(adminDb, canonicalPath), relationship));
  await assertSucceeds(getDoc(doc(adminDb, canonicalPath)));
  await assertFails(getDoc(doc(ordinaryDb, canonicalPath)));
  await assertFails(setDoc(doc(ordinaryDb, "leaderChildRelationships/leader-parent--member-other"), { ...relationship, memberId: "member-other", createdBy: "ordinary-leader", updatedBy: "ordinary-leader" }));
  await assertFails(setDoc(doc(adminDb, "leaderChildRelationships/noncanonical"), { ...relationship, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(groupLeaderDb, canonicalPath), { active: false, updatedBy: "group-leader", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(groupLeaderDb, canonicalPath), { active: "false", updatedBy: "group-leader", updatedAt: serverTimestamp() }));
});

test("unknown collections remain denied by the default rule", async () => {
  const db = testEnv.authenticatedContext("someone").firestore();
  await assertFails(setDoc(doc(db, "unexpectedCollection/doc-1"), { value: true }));
});

test("consentReminderDeliveries are server-only and cannot be forged by clients", async () => {
  await seedDocuments([
    ["consentReminderDeliveries/reminder-1", { memberId: "member-cub", recipientUid: "parent-1", status: "sent" }],
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-cub"], linkedSections: ["Cubs"] }],
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
  ]);

  for (const db of [
    testEnv.unauthenticatedContext().firestore(),
    testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore(),
    testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore(),
  ]) {
    const ref = doc(db, "consentReminderDeliveries/reminder-1");
    await assertFails(getDoc(ref));
    await assertFails(setDoc(doc(db, "consentReminderDeliveries/forged-reminder"), {
      memberId: "member-cub", recipientUid: "parent-1", status: "sent"
    }));
    await assertFails(updateDoc(ref, { status: "failed" }));
  }

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await assertSucceeds(getDoc(doc(db, "consentReminderDeliveries/reminder-1")));
  });
});
