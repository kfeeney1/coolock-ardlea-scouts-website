import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seedDocuments(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

function transaction(overrides = {}) {
  return {
    section: "Cubs",
    type: "income",
    amountCents: 500,
    category: "Weekly subs",
    description: "Weekly subs",
    transactionDate: "2026-08-30",
    sourceTransactionId: "",
    reversalOfTransactionId: "",
    createdBy: "leader-cubs",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function reconciliation(overrides = {}) {
  return {
    section: "Cubs",
    expectedBalanceCents: 5000,
    countedBalanceCents: 5000,
    differenceCents: 0,
    note: "",
    reconciledBy: "leader-cubs",
    reconciledAt: serverTimestamp(),
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

test("section leaders can manage their own section finance but not another section", async () => {
  await seedDocuments([["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }]]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(db, "financeTransactions/cubs-income"), transaction()));
  await assertFails(setDoc(doc(db, "financeTransactions/scouts-income"), transaction({ section: "Scouts" })));
  await assertSucceeds(getDocs(query(collection(db, "financeTransactions"), where("section", "==", "Cubs"))));
  await assertFails(getDocs(query(collection(db, "financeTransactions"), where("section", "==", "Scouts"))));
});

test("Group Treasurer can manage finance across all sections", async () => {
  await seedDocuments([
    ["adminUsers/treasurer", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/treasurer", { active: true, scoutingRole: "Group Treasurer" }],
    ["financeTransactions/cubs-income", { ...transaction(), createdAt: new Date() }],
    ["financeTransactions/scouts-income", { ...transaction({ section: "Scouts" }), createdAt: new Date() }],
  ]);
  const db = testEnv.authenticatedContext("treasurer", { email: "treasurer@example.com" }).firestore();
  await assertSucceeds(getDocs(query(collection(db, "financeTransactions"), where("section", "==", "Cubs"))));
  await assertSucceeds(getDocs(query(collection(db, "financeTransactions"), where("section", "==", "Scouts"))));
  await assertSucceeds(setDoc(doc(db, "financeTransactions/beavers-income"), transaction({ section: "Beavers", createdBy: "treasurer" })));
  await assertSucceeds(setDoc(doc(db, "financeReconciliations/beavers-count"), reconciliation({ section: "Beavers", reconciledBy: "treasurer" })));
});

test("Group Leader can manage finance across all sections", async () => {
  await seedDocuments([
    ["adminUsers/group-leader", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/group-leader", { active: true, scoutingRole: "Group Leader" }],
  ]);
  const db = testEnv.authenticatedContext("group-leader", { email: "gl@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(db, "financeTransactions/scouts-income"), transaction({ section: "Scouts", createdBy: "group-leader" })));
});

test("parents cannot read or write finance records", async () => {
  await seedDocuments([
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-cub"], linkedSections: ["Cubs"] }],
    ["financeTransactions/cubs-income", { ...transaction(), createdAt: new Date() }],
    ["financeReconciliations/cubs-count", { ...reconciliation(), reconciledAt: new Date() }],
  ]);
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertFails(getDoc(doc(db, "financeTransactions/cubs-income")));
  await assertFails(setDoc(doc(db, "financeTransactions/parent-write"), transaction({ createdBy: "parent-1" })));
  await assertFails(getDoc(doc(db, "financeReconciliations/cubs-count")));
  await assertFails(setDoc(doc(db, "financeReconciliations/parent-count"), reconciliation({ reconciledBy: "parent-1" })));
});

test("finance history is append-only", async () => {
  await seedDocuments([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["financeTransactions/cubs-income", { ...transaction(), createdAt: new Date() }],
    ["financeReconciliations/cubs-count", { ...reconciliation(), reconciledAt: new Date() }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  const transactionRef = doc(db, "financeTransactions/cubs-income");
  await assertFails(updateDoc(transactionRef, { amountCents: 999 }));
  await assertFails(deleteDoc(transactionRef));
  const reconciliationRef = doc(db, "financeReconciliations/cubs-count");
  await assertFails(updateDoc(reconciliationRef, { countedBalanceCents: 4999 }));
  await assertFails(deleteDoc(reconciliationRef));
});

test("corrections must be exact deterministic reversals of an existing transaction", async () => {
  await seedDocuments([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["financeTransactions/original", { ...transaction(), createdAt: new Date() }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  const correction = transaction({ type: "adjustment", amountCents: -500, reversalOfTransactionId: "original" });
  await assertFails(setDoc(doc(db, "financeTransactions/bad-adjustment-zero"), { ...correction, amountCents: 0 }));
  await assertFails(setDoc(doc(db, "financeTransactions/bad-adjustment-link"), { ...correction, reversalOfTransactionId: "" }));
  await assertFails(setDoc(doc(db, "financeTransactions/arbitrary-id"), correction));
  await assertFails(setDoc(doc(db, "financeTransactions/reversal-original"), { ...correction, amountCents: -499 }));
  await assertSucceeds(setDoc(doc(db, "financeTransactions/reversal-original"), correction));
  await assertFails(setDoc(doc(db, "financeTransactions/reversal-original"), correction));
});

test("expense corrections restore the original positive ledger effect", async () => {
  await seedDocuments([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["financeTransactions/expense-original", { ...transaction({ type: "expense", amountCents: 725 }), createdAt: new Date() }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(db, "financeTransactions/reversal-expense-original"), transaction({
    type: "adjustment",
    amountCents: 725,
    reversalOfTransactionId: "expense-original",
  })));
});

test("section reconciliation is section-scoped and internally consistent", async () => {
  await seedDocuments([["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }]]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(db, "financeReconciliations/balanced"), reconciliation()));
  await assertSucceeds(getDocs(query(collection(db, "financeReconciliations"), where("section", "==", "Cubs"))));
  await assertFails(getDocs(query(collection(db, "financeReconciliations"), where("section", "==", "Scouts"))));
  await assertFails(setDoc(doc(db, "financeReconciliations/other-section"), reconciliation({ section: "Scouts" })));
  await assertFails(setDoc(doc(db, "financeReconciliations/bad-arithmetic"), reconciliation({ countedBalanceCents: 4900, differenceCents: 0 })));
  await assertFails(setDoc(doc(db, "financeReconciliations/missing-note"), reconciliation({ countedBalanceCents: 4900, differenceCents: -100 })));
  await assertSucceeds(setDoc(doc(db, "financeReconciliations/explained-difference"), reconciliation({ countedBalanceCents: 4900, differenceCents: -100, note: "Cash count short" })));
});
