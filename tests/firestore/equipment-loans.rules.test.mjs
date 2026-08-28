import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

const item = {
  name: "4-person Tent",
  category: "Camping & Sleeping",
  trackingMode: "quantity",
  totalQuantity: 10,
  checkedOutQuantity: 0,
  unavailableQuantity: 0,
  location: "Main Store",
  condition: "good",
  notes: "",
  replacementValue: 250,
  archived: false,
  createdBy: "qm",
  createdAt: new Date(),
  updatedBy: "qm",
  updatedAt: new Date()
};

function loan(uid, section = "Scouts") {
  return {
    section,
    expectedReturnDate: "2026-09-04",
    notes: "Weekly meeting",
    status: "open",
    lines: [{ itemId: "tent", itemName: "4-person Tent", quantity: 2, returnedQuantity: 0, incidentQuantity: 0 }],
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedBy: uid,
    updatedAt: serverTimestamp()
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 }
  });
});

beforeEach(async () => { await testEnv.clearFirestore(); });
after(async () => { await testEnv.cleanup(); });

test("section leader can create and return a checkout for their section", async () => {
  await seed([
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["equipmentItems/tent", item]
  ]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  await assertSucceeds(setDoc(doc(db, "equipmentLoans/loan-1"), loan("scout-leader")));
  await assertSucceeds(updateDoc(doc(db, "equipmentItems/tent"), {
    checkedOutQuantity: 2,
    updatedBy: "scout-leader",
    updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(db, "equipmentLoans/loan-1"), {
    lines: [{ itemId: "tent", itemName: "4-person Tent", quantity: 2, returnedQuantity: 2, incidentQuantity: 0 }],
    status: "returned",
    updatedBy: "scout-leader",
    updatedAt: serverTimestamp()
  }));
});

test("section leader cannot create or update another section checkout", async () => {
  await seed([
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["equipmentLoans/cubs-loan", { ...loan("cub-leader", "Cubs"), createdAt: new Date(), updatedAt: new Date() }]
  ]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  await assertFails(setDoc(doc(db, "equipmentLoans/new-cubs-loan"), loan("scout-leader", "Cubs")));
  await assertFails(updateDoc(doc(db, "equipmentLoans/cubs-loan"), {
    status: "returned",
    lines: [{ itemId: "tent", itemName: "4-person Tent", quantity: 2, returnedQuantity: 2, incidentQuantity: 0 }],
    updatedBy: "scout-leader",
    updatedAt: serverTimestamp()
  }));
});

test("active leaders can view group equipment holdings while parents cannot", async () => {
  await seed([
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["parentAccounts/parent", { status: "approved", memberIds: [], linkedSections: ["Scouts"] }],
    ["equipmentLoans/loan-1", { ...loan("scout-leader"), createdAt: new Date(), updatedAt: new Date() }]
  ]);
  const leaderDb = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  const parentDb = testEnv.authenticatedContext("parent", { email: "parent@example.test" }).firestore();
  await assertSucceeds(getDocs(collection(leaderDb, "equipmentLoans")));
  await assertFails(getDocs(collection(parentDb, "equipmentLoans")));
});

test("ordinary leaders cannot change master stock fields", async () => {
  await seed([
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["equipmentItems/tent", item]
  ]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  await assertFails(updateDoc(doc(db, "equipmentItems/tent"), {
    totalQuantity: 99,
    updatedBy: "scout-leader",
    updatedAt: serverTimestamp()
  }));
});
