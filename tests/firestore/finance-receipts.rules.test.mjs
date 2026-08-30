import fs from "node:fs";
import test, { before, beforeEach } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: "coolock-ardlea-scouts", firestore: { rules: fs.readFileSync("firestore.rules", "utf8") } });
});
beforeEach(async () => { await env.clearFirestore(); });

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "adminUsers", "cubs-leader"), { active: true, role: "leader", sections: ["Cubs"], displayName: "Cub Leader", email: "cubs@example.test" });
    await setDoc(doc(db, "adminUsers", "treasurer"), { active: true, role: "leader", sections: ["Cubs"], displayName: "Treasurer", email: "treasurer@example.test" });
    await setDoc(doc(db, "organisationLeadership", "treasurer"), { active: true, scoutingRole: "Group Treasurer" });
    await setDoc(doc(db, "financeTransactions", "tx-cubs"), { section: "Cubs", type: "expense", amountCents: 1000, category: "Equipment", description: "Rope", transactionDate: "2026-08-30", sourceTransactionId: "", reversalOfTransactionId: "", createdBy: "cubs-leader", createdAt: new Date() });
    await setDoc(doc(db, "financeTransactions", "tx-scouts"), { section: "Scouts", type: "expense", amountCents: 1000, category: "Equipment", description: "Rope", transactionDate: "2026-08-30", sourceTransactionId: "", reversalOfTransactionId: "", createdBy: "treasurer", createdAt: new Date() });
  });
}

function receipt(transactionId, section, uploadedBy) {
  return { transactionId, section, storagePath: `attachments/finance-receipts/${section}/a/receipt.pdf`, fileName: "receipt.pdf", contentType: "application/pdf", size: 1234, downloadUrl: "https://example.test/receipt", uploadedBy, uploadedAt: new Date() };
}

test("section leader can create/read receipt only for an accessible matching transaction", async () => {
  await seed();
  const db = env.authenticatedContext("cubs-leader").firestore();
  await assertSucceeds(addDoc(collection(db, "financeReceipts"), receipt("tx-cubs", "Cubs", "cubs-leader")));
  await assertFails(addDoc(collection(db, "financeReceipts"), receipt("tx-scouts", "Scouts", "cubs-leader")));
  await assertSucceeds(getDocs(query(collection(db, "financeReceipts"), where("section", "==", "Cubs"))));
});

test("treasurer can attach receipts across sections while parents cannot read them", async () => {
  await seed();
  const treasurer = env.authenticatedContext("treasurer").firestore();
  const created = await assertSucceeds(addDoc(collection(treasurer, "financeReceipts"), receipt("tx-scouts", "Scouts", "treasurer")));
  const parent = env.authenticatedContext("parent").firestore();
  await assertFails(getDoc(doc(parent, "financeReceipts", created.id)));
});
