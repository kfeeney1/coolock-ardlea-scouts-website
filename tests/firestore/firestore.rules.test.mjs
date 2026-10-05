import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
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
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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

test("active adult leader may self-create and end only their Rover membership", async () => {
  await seedDocuments([["adminUsers/rover-leader", { active: true, role: "leader", sections: ["Cubs"] }]]);
  const db = testEnv.authenticatedContext("rover-leader", { email: "rover@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(db, "members/rover_rover-leader"), {
    firstName: "Rory", lastName: "Rover", displayName: "Rory Rover", displayNameMode: "auto",
    dateOfBirth: "", section: "Rovers", sections: ["Rovers"], sectionRoles: {}, parentName: "",
    emailAddress: "rover@example.com", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "",
    status: "active", source: "rover-self-service", sourceJoinApplicationId: "", accountUid: "rover-leader",
    createdAt: serverTimestamp(), createdBy: "rover-leader", updatedAt: serverTimestamp(), updatedBy: "rover-leader",
  }));
  const memberRef = doc(db, "members/rover_rover-leader");
  await assertFails(updateDoc(memberRef, { emailAddress: "other@example.com", accountUid: "rover-leader", updatedAt: serverTimestamp(), updatedBy: "rover-leader" }));
  await assertSucceeds(updateDoc(memberRef, {
    sections: ["Cubs", "Rovers"], section: "Cubs", status: "active", accountUid: "rover-leader",
    sectionRoles: {}, updatedAt: serverTimestamp(), updatedBy: "rover-leader",
  }));
  await assertSucceeds(updateDoc(memberRef, {
    sections: ["Cubs"], section: "Cubs", status: "active", accountUid: "rover-leader",
    sectionRoles: {}, updatedAt: serverTimestamp(), updatedBy: "rover-leader",
  }));
  await assertFails(updateDoc(memberRef, { familyId: "forged-family", accountUid: "rover-leader", updatedAt: serverTimestamp(), updatedBy: "rover-leader" }));
});

test("member transition links are section scoped, short lived, read only for registration, and consumed by admin approval", async () => {
  await seedDocuments([
    ["adminUsers/cubs-leader", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["members/member-cub", { firstName: "Casey", lastName: "Cub", displayName: "Casey Cub", section: "Cubs", sections: ["Cubs"], emailAddress: "casey@example.com", mobileNumber: "0871111111", status: "active" }],
    ["members/member-scout", { firstName: "Sam", lastName: "Scout", displayName: "Sam Scout", section: "Scouts", sections: ["Scouts"], emailAddress: "sam@example.com", mobileNumber: "0872222222", status: "active" }],
  ]);
  const leaderDb = testEnv.authenticatedContext("cubs-leader", { email: "leader@example.com" }).firestore();
  const strangerDb = testEnv.authenticatedContext("stranger", { email: "stranger@example.com" }).firestore();
  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
  const invitation = {
    memberId: "member-cub", firstName: "Casey", lastName: "Cub", displayName: "Casey Cub",
    emailAddress: "casey@example.com", mobileNumber: "0871111111", section: "Cubs",
    endMemberMembership: true, status: "pending", createdBy: "cubs-leader",
    createdAt: serverTimestamp(), expiresAt: new Date(Date.now() + 60_000),
  };
  await assertSucceeds(setDoc(doc(leaderDb, "leaderTransitionInvitations/secure-random-invite-123"), invitation));
  await assertFails(setDoc(doc(leaderDb, "leaderTransitionInvitations/out-of-scope-invite-123"), { ...invitation, memberId: "member-scout", emailAddress: "sam@example.com", section: "Scouts" }));
  await assertSucceeds(getDoc(doc(strangerDb, "leaderTransitionInvitations/secure-random-invite-123")));
  await assertFails(getDocs(collection(strangerDb, "leaderTransitionInvitations")));
  const memberDb = testEnv.authenticatedContext("member-account", { email: "casey@example.com" }).firestore();
  const transitionRequest = { uid: "member-account", email: "casey@example.com", status: "pending", privacyConfirmed: true, transitionInvitationId: "secure-random-invite-123", transitionEndMemberMembership: true };
  await assertSucceeds(setDoc(doc(memberDb, "leaderRegistrationRequests/member-account"), transitionRequest));
  await assertFails(setDoc(doc(strangerDb, "leaderRegistrationRequests/stranger"), { ...transitionRequest, uid: "stranger" }));
  const wrongChoiceDb = testEnv.authenticatedContext("wrong-choice", { email: "casey@example.com" }).firestore();
  await assertFails(setDoc(doc(wrongChoiceDb, "leaderRegistrationRequests/wrong-choice"), { ...transitionRequest, uid: "wrong-choice", transitionEndMemberMembership: false }));
  await assertFails(updateDoc(doc(strangerDb, "leaderTransitionInvitations/secure-random-invite-123"), { status: "used", usedBy: "stranger", usedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(adminDb, "members/member-cub"), { accountUid: "member-account", status: "left", updatedAt: serverTimestamp(), updatedBy: "admin-1" }));
  await assertSucceeds(updateDoc(doc(adminDb, "leaderTransitionInvitations/secure-random-invite-123"), { status: "used", usedBy: "member-account", usedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(leaderDb, "members/member-cub"), { accountUid: "forged-account", updatedAt: serverTimestamp(), updatedBy: "cubs-leader" }));
});

test("Rover self-service read is limited to records carrying the caller's email or uid", async () => {
  await seedDocuments([
    ["adminUsers/rover-leader", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/own-rover", { section: "Cubs", sections: ["Cubs", "Rovers"], emailAddress: "rover@example.com", accountUid: "rover-leader" }],
    ["members/other-rover", { section: "Rovers", sections: ["Rovers"], emailAddress: "other@example.com", accountUid: "other-user" }],
  ]);
  const db = testEnv.authenticatedContext("rover-leader", { email: "rover@example.com" }).firestore();
  const own = await assertSucceeds(getDocs(query(collection(db, "members"), where("emailAddress", "==", "rover@example.com"))));
  assert.deepEqual(own.docs.map((snapshot) => snapshot.id), ["own-rover"]);
  await assertFails(getDoc(doc(db, "members/other-rover")));
});

test("member writes reject Group and Other as member or Primary sections", async () => {
  await seedDocuments([["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }]]);
  const db = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
  const base = { firstName: "Test", lastName: "Member", displayName: "Test Member", dateOfBirth: "2010-01-01",
    sectionRoles: {}, status: "active", source: "manual", createdBy: "admin-1" };
  await assertFails(setDoc(doc(db, "members/group-member"), { ...base, section: "Group", sections: ["Group"], createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, "members/other-member"), { ...base, section: "Other", sections: ["Other"], createdAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(db, "members/valid-member"), { ...base, section: "Cubs", sections: ["Cubs", "Scouts"], createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "members/valid-member"), { section: "Group", sections: ["Group", "Cubs"], updatedAt: serverTimestamp(), updatedBy: "admin-1" }));
});

test("Rover Section Leader, Group Leader and super-admin may manage Rover membership while ordinary leaders may not", async () => {
  await seedDocuments([
    ["adminUsers/target-adult", { active: true, role: "leader", sections: ["Cubs"], displayName: "Target Adult", email: "target@example.com" }],
    ["adminUsers/rover-section-leader", { active: true, role: "leader", sections: ["Rovers"], displayName: "Rover SL", email: "roversl@example.com" }],
    ["organisationLeadership/rover-section-leader", { active: true, scoutingRole: "Section Leader", appointments: [{ appointment: "Section Leader", scope: "Rovers", active: true }] }],
    ["adminUsers/group-leader", { active: true, role: "leader", sections: ["Group"], displayName: "Group Leader", email: "gl@example.com" }],
    ["organisationLeadership/group-leader", { active: true, scoutingRole: "Group Leader" }],
    ["adminUsers/super-admin", { active: true, role: "super-admin", sections: ["Group"], displayName: "Super Admin", email: "admin@example.com" }],
    ["adminUsers/cubs-leader", { active: true, role: "leader", sections: ["Cubs"], displayName: "Cubs Leader", email: "cubs@example.com" }],
    ["members/target-member", { firstName: "Target", lastName: "Adult", displayName: "Target Adult", dateOfBirth: "", section: "Cubs", sections: ["Cubs"], sectionRoles: {}, emailAddress: "target@example.com", accountUid: "target-adult", status: "active", source: "manual" }],
  ]);
  const change = (actor) => ({ accountUid: "target-adult", section: "Cubs", sections: ["Cubs", "Rovers"], sectionRoles: {}, status: "active", updatedAt: serverTimestamp(), updatedBy: actor, roverManagementAt: serverTimestamp() });
  for (const actor of ["rover-section-leader", "group-leader", "super-admin"]) {
    const db = testEnv.authenticatedContext(actor, { email: actor + "@example.com" }).firestore();
    await assertSucceeds(updateDoc(doc(db, "members/target-member"), change(actor)));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "members/target-member"), { section: "Cubs", sections: ["Cubs"], updatedBy: "reset" });
    });
  }
  const denied = testEnv.authenticatedContext("cubs-leader", { email: "cubs@example.com" }).firestore();
  await assertFails(updateDoc(doc(denied, "members/target-member"), change("cubs-leader")));
});

test("a reserved Rover ID cannot overwrite an unrelated member record", async () => {
  await seedDocuments([
    ["adminUsers/rover-leader", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/rover_rover-leader", { firstName: "Other", lastName: "Member", displayName: "Other Member", dateOfBirth: "2015-01-01", section: "Cubs", sections: ["Cubs"], status: "active", emailAddress: "family@example.com" }],
  ]);
  const db = testEnv.authenticatedContext("rover-leader", { email: "rover@example.com" }).firestore();
  await assertFails(updateDoc(doc(db, "members/rover_rover-leader"), {
    firstName: "Rory", lastName: "Rover", displayName: "Rory Rover", dateOfBirth: "", section: "Rovers",
    sections: ["Rovers"], status: "active", source: "rover-self-service", accountUid: "rover-leader",
    updatedAt: serverTimestamp(), updatedBy: "rover-leader",
  }));
  const stored = await assertSucceeds(getDoc(doc(db, "members/rover_rover-leader")));
  assert.equal(stored.data().displayName, "Other Member");
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
    ["members/member-scout", { section: "Scouts", displayName: "Out of scope Scout" }],
  ]);
  const db = testEnv.authenticatedContext("leader-ventures", { email: "venture@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "members/member-venture")));
  const aliasQuery = await assertSucceeds(getDocs(query(collection(db, "members"), where("section", "==", "Venture Scout"))));
  assert.deepEqual(aliasQuery.docs.map((snapshot) => snapshot.id), ["member-venture"]);
  await assertFails(getDocs(collection(db, "members")));
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
  await assertSucceeds(updateDoc(doc(db, "members/member-cub"), {
    sectionRoles: { Cubs: "Sixer" },
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

test("SW-155 source-section leaders can transfer without destination access and do not gain it", async () => {
  await seedDocuments([
    ["adminUsers/leader-beavers", { active: true, role: "leader", sections: ["Beavers"] }],
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/leader-scouts", { active: true, role: "leader", sections: ["Scouts"] }],
    ["adminUsers/leader-ventures", { active: true, role: "leader", sections: ["Ventures"] }],
    ["adminUsers/leader-rovers", { active: true, role: "leader", sections: ["Rovers"] }],
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/super-1", { active: true, role: "super-admin", sections: ["Group"] }],
    ["members/member-beaver", { section: "Beavers", sections: ["Beavers"], displayName: "Test Beaver", status: "active" }],
    ["members/member-scout", { section: "Scouts", sections: ["Scouts"], displayName: "Test Scout", status: "active" }],
    ["members/member-rover", { section: "Rovers", sections: ["Rovers"], displayName: "Test Rover", status: "active" }],
  ]);

  const transfer = async (uid, memberId, fromSection, toSection, historyId) => {
    const db = testEnv.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, `members/${memberId}`), {
      section: toSection,
      sections: [toSection],
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    batch.set(doc(db, `memberHistory/${historyId}`), {
      memberId,
      memberName: memberId,
      changeType: "section-transfer",
      fromSection,
      toSection,
      fromStatus: "active",
      toStatus: "active",
      changedBy: uid,
      changedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    return db;
  };

  const beaverDb = await transfer("leader-beavers", "member-beaver", "Beavers", "Cubs", "history-beaver-cub");
  await assertFails(getDoc(doc(beaverDb, "members/member-beaver")));
  await assertFails(getDoc(doc(beaverDb, "members/member-scout")));
  const cubDb = testEnv.authenticatedContext("leader-cubs", { email: "cubs@example.com" }).firestore();
  const movedBeaver = await assertSucceeds(getDoc(doc(cubDb, "members/member-beaver")));
  assert.equal(movedBeaver.data().section, "Cubs");
  assert.deepEqual(movedBeaver.data().sections, ["Cubs"]);

  await transfer("leader-scouts", "member-scout", "Scouts", "Ventures", "history-scout-venture");
  const ventureDb = testEnv.authenticatedContext("leader-ventures", { email: "ventures@example.com" }).firestore();
  assert.equal((await assertSucceeds(getDoc(doc(ventureDb, "members/member-scout")))).data().section, "Ventures");

  const roverDb = testEnv.authenticatedContext("leader-beavers", { email: "beavers@example.com" }).firestore();
  await assertFails(updateDoc(doc(roverDb, "members/member-rover"), {
    section: "Cubs", sections: ["Cubs"], updatedAt: serverTimestamp(), updatedBy: "leader-beavers",
  }));

  for (const uid of ["admin-1", "super-1"]) {
    await seedDocuments([["members/member-admin-transfer", { section: "Beavers", sections: ["Beavers"], displayName: "Admin Transfer", status: "active" }]]);
    await transfer(uid, "member-admin-transfer", "Beavers", "Cubs", `history-${uid}`);
  }

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const history = await getDoc(doc(db, "memberHistory/history-beaver-cub"));
    assert.equal(history.data().changedBy, "leader-beavers");
    assert.equal(history.data().fromSection, "Beavers");
    assert.equal(history.data().toSection, "Cubs");
    assert.ok(history.data().changedAt);
  });
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
    section: "Cubs",
    informationConfirmed: true,
    contactConsent: true,
    status: "new",
    source: "website",
    submittedAt: serverTimestamp(),
  };

  await assertSucceeds(setDoc(doc(db, "joinApplications/valid"), canonical));
  await assertSucceeds(setDoc(doc(db, "joinApplications/legacy-with-emergency-details"), {
    ...canonical,
    emergencyContactName: "Existing Emergency Contact",
    emergencyContactPhone: "0871111111",
  }));
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
    ["organisationLeadership/group-leader", { active: true, userId: "group-leader", scoutingRole: "Group Leader" }],
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
