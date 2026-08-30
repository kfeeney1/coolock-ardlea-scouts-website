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
  await assertSucceeds(getDocs(collection(db, "financeTransactions")));
  await assertSucceeds(setDoc(doc(db, "financeTransactions/beavers-income"), transaction({ section: "Beavers", createdBy: "treasurer" })));
});

test("Group Leader can manage finance across all sections", async () => {
  await seedDocuments([
    ["adminUsers/group-leader", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/group-leader", { active: true, scoutingRole: "Group Leader" }],
  ]);
  const db = testEnv.authenticatedContext("group-leader", { email: "gl@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(db, "financeTransactions/scouts-income"), transaction({ section: "Scouts", createdBy: "group-leader" })));
});

test("parents cannot read or write finance transactions", async () => {
  await seedDocuments([
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-cub"], linkedSections: ["Cubs"] }],
    ["financeTransactions/cubs-income", { ...transaction(), createdAt: new Date() }],
  ]);
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertFails(getDoc(doc(db, "financeTransactions/cubs-income")));
  await assertFails(setDoc(doc(db, "financeTransactions/parent-write"), transaction({ createdBy: "parent-1" })));
});

test("finance history is append-only", async () => {
  await seedDocuments([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["financeTransactions/cubs-income", { ...transaction(), createdAt: new Date() }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  const ref = doc(db, "financeTransactions/cubs-income");
  await assertFails(updateDoc(ref, { amountCents: 999 }));
  await assertFails(deleteDoc(ref));
});

test("adjustments must be non-zero and reference an earlier transaction", async () => {
  await seedDocuments([["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }]]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  await assertFails(setDoc(doc(db, "financeTransactions/bad-adjustment-zero"), transaction({ type: "adjustment", amountCents: 0, reversalOfTransactionId: "original" })));
  await assertFails(setDoc(doc(db, "financeTransactions/bad-adjustment-link"), transaction({ type: "adjustment", amountCents: -500, reversalOfTransactionId: "" })));
  await assertSucceeds(setDoc(doc(db, "financeTransactions/good-adjustment"), transaction({ type: "adjustment", amountCents: -500, reversalOfTransactionId: "original" })));
});
