import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

function transferTransaction({ section, type, createdBy, transferId }) {
  return {
    section,
    type,
    amountCents: 1250,
    category: "Bank / transfer",
    description: type === "transfer-out" ? "Transfer to Scouts: Camp float" : "Transfer from Cubs: Camp float",
    transactionDate: "2026-08-30",
    sourceTransactionId: transferId,
    reversalOfTransactionId: "",
    createdBy,
    createdAt: serverTimestamp(),
  };
}

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

beforeEach(async () => { await testEnv.clearFirestore(); });
after(async () => { await testEnv.cleanup(); });

test("section leader cannot partially transfer money into an unassigned section", async () => {
  await seed([["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }]]);
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  const transferId = "transfer-one";
  const batch = writeBatch(db);
  batch.set(doc(db, `financeTransactions/${transferId}-out`), transferTransaction({ section: "Cubs", type: "transfer-out", createdBy: "leader-cubs", transferId }));
  batch.set(doc(db, `financeTransactions/${transferId}-in`), transferTransaction({ section: "Scouts", type: "transfer-in", createdBy: "leader-cubs", transferId }));
  await assertFails(batch.commit());

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    assert.equal((await getDoc(doc(adminDb, `financeTransactions/${transferId}-out`))).exists(), false);
    assert.equal((await getDoc(doc(adminDb, `financeTransactions/${transferId}-in`))).exists(), false);
  });
});

test("Group Treasurer can commit both sides of a section transfer atomically", async () => {
  await seed([
    ["adminUsers/treasurer", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/treasurer", { active: true, scoutingRole: "Group Treasurer" }],
  ]);
  const db = testEnv.authenticatedContext("treasurer", { email: "treasurer@example.com" }).firestore();
  const transferId = "transfer-two";
  const batch = writeBatch(db);
  const outRef = doc(db, `financeTransactions/${transferId}-out`);
  const inRef = doc(db, `financeTransactions/${transferId}-in`);
  batch.set(outRef, transferTransaction({ section: "Cubs", type: "transfer-out", createdBy: "treasurer", transferId }));
  batch.set(inRef, transferTransaction({ section: "Scouts", type: "transfer-in", createdBy: "treasurer", transferId }));
  await assertSucceeds(batch.commit());
  assert.equal((await assertSucceeds(getDoc(outRef))).exists(), true);
  assert.equal((await assertSucceeds(getDoc(inRef))).exists(), true);
});
