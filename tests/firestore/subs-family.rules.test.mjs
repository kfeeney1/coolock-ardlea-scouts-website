import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seedDocuments(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

const policy = {
  period: "2026/27",
  effectiveFrom: "2026-09-01",
  periodStart: "2026-09-01",
  periodEnd: "2027-06-30",
  standardCents: 26400,
  leaderChildCents: 20500,
  siblingCents: 15500,
  standardFamilyRatesCents: [26400, 41900, 52400, 62900],
  leaderFamilyRatesCents: [20500, 34300, 46500],
  version: 1,
  createdBy: "treasurer",
  createdAt: new Date(),
};

const members = [
  ["members/member-beaver", { displayName: "Beaver Child", section: "Beavers", status: "active" }],
  ["members/member-cub", { displayName: "Cub Child", section: "Cubs", status: "active" }],
  ["members/member-scout", { displayName: "Scout Child", section: "Scouts", status: "active" }],
];

function account(overrides = {}) {
  return {
    period: "2026/27",
    policyId: "2026-v1",
    policyVersion: 1,
    familyType: "standard",
    memberIds: ["member-beaver", "member-cub", "member-scout"],
    sections: ["Beavers", "Cubs", "Scouts"],
    childCount: 3,
    amountDueCents: 52400,
    classificationSource: "finance-officer-confirmed",
    classificationNote: "Confirmed against controlled family record",
    createdBy: "treasurer",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function assignment(memberId, memberName, section, position, amountDueCents, overrides = {}) {
  return {
    memberId,
    memberName,
    section,
    period: "2026/27",
    category: position === 1 ? "standard" : "sibling",
    amountDueCents,
    policyId: "2026-v1",
    policyVersion: 1,
    sibling: position > 1,
    leaderChild: false,
    familyType: "standard",
    familyPosition: position,
    accountId: "2026-27--member-beaver--member-cub--member-scout",
    accountAmountDueCents: 52400,
    accountChildCount: 3,
    classifiedBy: "treasurer",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function payment(overrides = {}) {
  return {
    memberId: "member-cub",
    memberName: "Cub Child",
    section: "Cubs",
    period: "2026/27",
    accountId: "2026-27--member-beaver--member-cub--member-scout",
    amountCents: 10000,
    method: "cash",
    paymentDate: "2026-09-10",
    reversalOfPaymentId: "",
    note: "",
    recordedBy: "treasurer",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
beforeEach(async () => { await testEnv.clearFirestore(); });
after(async () => { await testEnv.cleanup(); });

async function seedBase() {
  await seedDocuments([
    ["adminUsers/treasurer", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/treasurer", { active: true, scoutingRole: "Group Treasurer" }],
    ["adminUsers/gl", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/gl", { active: true, scoutingRole: "Group Leader" }],
    ["adminUsers/dgl", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/dgl", { active: true, scoutingRole: "Deputy Group Leader" }],
    ["adminUsers/cub-leader", { active: true, role: "leader", sections: ["Cubs"] }],
    ["subsRatePolicies/2026-v1", policy],
    ...members,
  ]);
}

test("Treasurer can create an immutable cross-section family account with member assignments", async () => {
  await seedBase();
  const db = testEnv.authenticatedContext("treasurer", { email: "treasurer@example.com" }).firestore();
  const accountId = "2026-27--member-beaver--member-cub--member-scout";
  await assertSucceeds(setDoc(doc(db, `subsAccounts/${accountId}`), account()));
  await assertSucceeds(setDoc(doc(db, "subsAssignments/member-beaver--2026-27"), assignment("member-beaver", "Beaver Child", "Beavers", 1, 26400)));
  await assertSucceeds(setDoc(doc(db, "subsAssignments/member-cub--2026-27"), assignment("member-cub", "Cub Child", "Cubs", 2, 15500)));
  await assertSucceeds(setDoc(doc(db, "subsAssignments/member-scout--2026-27"), assignment("member-scout", "Scout Child", "Scouts", 3, 10500)));
  await assertFails(updateDoc(doc(db, `subsAccounts/${accountId}`), { amountDueCents: 1 }));
  await assertFails(deleteDoc(doc(db, `subsAccounts/${accountId}`)));
  await assertFails(setDoc(doc(db, `subsAccounts/${accountId}`), account()));
});

test("Group Leader and Deputy Group Leader can access family finance while section leaders cannot read family membership", async () => {
  await seedBase();
  const accountId = "2026-27--member-beaver--member-cub--member-scout";
  await seedDocuments([[`subsAccounts/${accountId}`, { ...account(), createdAt: new Date() }]]);
  const gl = testEnv.authenticatedContext("gl", { email: "gl@example.com" }).firestore();
  const dgl = testEnv.authenticatedContext("dgl", { email: "dgl@example.com" }).firestore();
  const cubLeader = testEnv.authenticatedContext("cub-leader", { email: "cub@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(gl, `subsAccounts/${accountId}`)));
  await assertSucceeds(getDoc(doc(dgl, `subsAccounts/${accountId}`)));
  await assertFails(getDoc(doc(cubLeader, `subsAccounts/${accountId}`)));
  await assertFails(getDocs(collection(cubLeader, "subsAccounts")));
});

test("family account rejects a missing configured rate and malformed membership snapshots", async () => {
  await seedBase();
  const db = testEnv.authenticatedContext("treasurer", { email: "treasurer@example.com" }).firestore();
  await assertFails(setDoc(doc(db, "subsAccounts/bad-rate"), account({ childCount: 5, amountDueCents: 73400 })));
  await assertFails(setDoc(doc(db, "subsAccounts/bad-count"), account({ childCount: 2 })));
  await assertFails(setDoc(doc(db, "subsAccounts/bad-source"), account({ classificationSource: "surname-match" })));
});

test("family payments and exact reversals preserve account provenance", async () => {
  await seedBase();
  const accountId = "2026-27--member-beaver--member-cub--member-scout";
  await seedDocuments([[`subsAccounts/${accountId}`, { ...account(), createdAt: new Date() }]]);
  const db = testEnv.authenticatedContext("treasurer", { email: "treasurer@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(db, "subsPayments/family-payment"), payment()));
  await assertFails(setDoc(doc(db, "subsPayments/wrong-family"), payment({ accountId: "other-family" })));
  await assertFails(setDoc(doc(db, "subsPayments/wrong-member"), payment({ memberId: "member-scout", memberName: "Scout Child", section: "Scouts", accountId: "other-family" })));
  await assertSucceeds(setDoc(doc(db, "subsPayments/reversal-family-payment"), payment({
    amountCents: -10000,
    reversalOfPaymentId: "family-payment",
    note: "Wrong amount",
  })));
  await assertFails(setDoc(doc(db, "subsPayments/reversal-family-payment-wrong"), payment({
    amountCents: -10000,
    reversalOfPaymentId: "family-payment",
    accountId: "other-family",
    note: "Wrong account",
  })));
});

test("section-scoped users cannot inspect sibling payments from another section", async () => {
  await seedBase();
  const accountId = "2026-27--member-beaver--member-cub--member-scout";
  await seedDocuments([
    [`subsAccounts/${accountId}`, { ...account(), createdAt: new Date() }],
    ["subsPayments/beaver-payment", { ...payment({ memberId: "member-beaver", memberName: "Beaver Child", section: "Beavers", recordedBy: "treasurer" }), createdAt: new Date() }],
    ["subsPayments/cub-payment", { ...payment({ memberId: "member-cub", memberName: "Cub Child", section: "Cubs", recordedBy: "treasurer" }), createdAt: new Date() }],
  ]);
  const cubLeader = testEnv.authenticatedContext("cub-leader", { email: "cub@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(cubLeader, "subsPayments/cub-payment")));
  await assertFails(getDoc(doc(cubLeader, "subsPayments/beaver-payment")));
});
