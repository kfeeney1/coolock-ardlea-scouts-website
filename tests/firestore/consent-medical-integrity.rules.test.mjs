import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;
async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}
before(async () => { testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } }); });
beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

const consent = { status: "active", source: "website", section: "Cubs", formType: "youth-activity-consent", formVersion: "stage2-2026-08", childName: "Alex Scout", childDOB: "2015-01-02", submittedAt: serverTimestamp() };

test("public consent creation cannot forge a canonical member relationship", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, "consentApplications/public-ok"), consent));
  await assertFails(setDoc(doc(db, "consentApplications/public-forged"), { ...consent, memberId: "member-other" }));
});

test("SW-309 profile sources are readable by UID owner only", async () => {
  await seed([
    ["adminUsers/scouter-1", { active: true, role: "leader", sections: ["Scouts"] }],
    ["adminUsers/scouter-2", { active: true, role: "leader", sections: ["Beavers"] }],
    ["leaderRegistrationRequests/scouter-1", { uid: "scouter-1", mobileNumber: "0861234567" }],
    ["leaderRegistrationRequests/scouter-2", { uid: "scouter-2", mobileNumber: "0869999999" }],
    ["members/member-own", { accountUid: "scouter-1", displayName: "Own Scouter", dateOfBirth: "1985-04-12", section: "Scouts", status: "active" }],
    ["members/member-other", { accountUid: "scouter-2", displayName: "Other Scouter", dateOfBirth: "1980-03-02", section: "Beavers", status: "active" }]
  ]);
  const db = testEnv.authenticatedContext("scouter-1", { email: "scouter-1@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "leaderRegistrationRequests/scouter-1")));
  await assertFails(getDoc(doc(db, "leaderRegistrationRequests/scouter-2")));
  const ownMembers = await assertSucceeds(getDocs(query(collection(db, "members"), where("accountUid", "==", "scouter-1"))));
  assert.equal(ownMembers.size, 1);
  assert.equal(ownMembers.docs[0].id, "member-own");
  await assertFails(getDoc(doc(db, "members/member-other")));
});

test("approved parent can create consent only for an explicitly linked member", async () => {
  await seed([
    ["members/member-own", { displayName: "Alex Scout", dateOfBirth: "2015-01-02", section: "Cubs", status: "active" }],
    ["members/member-other", { displayName: "Other Scout", dateOfBirth: "2015-02-03", section: "Cubs", status: "active" }],
    ["parentAccounts/parent-1", { uid: "parent-1", status: "approved", memberIds: ["member-own"], linkedSections: ["Cubs"] }]
  ]);
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(db, "consentApplications/parent-own"), { ...consent, memberId: "member-own" }));
  await assertFails(setDoc(doc(db, "consentApplications/parent-other"), { ...consent, memberId: "member-other" }));
});

test("only Super Admin can replace an existing canonical relationship with reconciliation metadata", async () => {
  await seed([
    ["members/member-old", { displayName: "Old Scout", dateOfBirth: "2015-01-02", section: "Cubs", status: "active" }],
    ["members/member-new", { displayName: "Alex Scout", dateOfBirth: "2015-01-02", section: "Cubs", status: "active" }],
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Cubs"] }],
    ["adminUsers/super-1", { active: true, role: "super-admin", sections: ["Group"] }],
    ["consentApplications/consent-1", { ...consent, submittedAt: new Date(), memberId: "member-old" }]
  ]);
  const update = { memberId: "member-new", linkedBy: "super-1", linkedAt: serverTimestamp(), updatedAt: serverTimestamp(), reconciliationReason: "Verified against parent and DOB.", reconciledBy: "super-1", reconciledAt: serverTimestamp() };
  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
  await assertFails(updateDoc(doc(adminDb, "consentApplications/consent-1"), { ...update, linkedBy: "admin-1", reconciledBy: "admin-1" }));
  const superDb = testEnv.authenticatedContext("super-1", { email: "super@example.com" }).firestore();
  await assertSucceeds(updateDoc(doc(superDb, "consentApplications/consent-1"), update));
});


test("SW-156 linked consent follows the member's current authorized section after a transfer", async () => {
  await seed([
    ["members/member-moved", { displayName: "Alex Scout", dateOfBirth: "2015-01-02", section: "Cubs", sections: ["Cubs"], status: "active" }],
    ["adminUsers/cub-leader", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/beaver-leader", { active: true, role: "leader", sections: ["Beavers"] }],
    ["adminUsers/super-1", { active: true, role: "super-admin", sections: ["Group"] }],
    ["consentApplications/consent-moved", { ...consent, section: "Beavers", submittedAt: new Date(), memberId: "member-moved" }]
  ]);

  const cubDb = testEnv.authenticatedContext("cub-leader", { email: "cub@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(cubDb, "consentApplications/consent-moved")));

  const oldSectionDb = testEnv.authenticatedContext("beaver-leader", { email: "beaver@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(oldSectionDb, "consentApplications/consent-moved")));

  const superDb = testEnv.authenticatedContext("super-1", { email: "super@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(superDb, "consentApplications/consent-moved")));
});

test("SW-156 linked consent supports concurrent current sections and denies unrelated leaders", async () => {
  await seed([
    ["members/member-shared", { displayName: "Alex Scout", dateOfBirth: "2015-01-02", section: "Cubs", sections: ["Cubs", "Scouts"], status: "active" }],
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["adminUsers/venture-leader", { active: true, role: "leader", sections: ["Ventures"] }],
    ["consentApplications/consent-shared", { ...consent, section: "Beavers", submittedAt: new Date(), memberId: "member-shared" }]
  ]);

  const scoutDb = testEnv.authenticatedContext("scout-leader", { email: "scout@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(scoutDb, "consentApplications/consent-shared")));

  const ventureDb = testEnv.authenticatedContext("venture-leader", { email: "venture@example.com" }).firestore();
  await assertFails(getDoc(doc(ventureDb, "consentApplications/consent-shared")));
});
