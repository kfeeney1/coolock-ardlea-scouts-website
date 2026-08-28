import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

function history(uid, type = "equipment-returned") {
  return {
    itemId: "tent",
    itemName: "4-person Tent",
    type,
    quantity: 1,
    section: "Scouts",
    fromLocation: "Scouts",
    toLocation: "Main Store",
    details: "Returned 1 × 4-person Tent from Scouts.",
    sourceId: "loan-1",
    linkedItemId: "",
    createdBy: uid,
    createdAt: serverTimestamp()
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

test("active section leaders can read history and append operational checkout or return history", async () => {
  await seed([["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }]]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  await assertSucceeds(setDoc(doc(db, "equipmentHistory/return-1"), history("scout-leader")));
  await assertSucceeds(getDoc(doc(db, "equipmentHistory/return-1")));
});

test("section leaders cannot forge master-stock movement or management history", async () => {
  await seed([["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }]]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  await assertFails(setDoc(doc(db, "equipmentHistory/move-1"), history("scout-leader", "stock-moved")));
  await assertFails(setDoc(doc(db, "equipmentHistory/update-1"), history("scout-leader", "item-updated")));
  await assertFails(setDoc(doc(db, "equipmentHistory/resolution-1"), history("scout-leader", "incident-resolved")));
});

test("quartermaster can append stock movement history", async () => {
  await seed([
    ["adminUsers/qm", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/qm", { active: true, scoutingRole: "Group Quartermaster / Bo'sun" }]
  ]);
  const db = testEnv.authenticatedContext("qm", { email: "qm@example.test" }).firestore();
  await assertSucceeds(setDoc(doc(db, "equipmentHistory/move-1"), history("qm", "stock-moved")));
});

test("equipment history is immutable after creation", async () => {
  await seed([
    ["adminUsers/web-admin", { active: true, role: "admin", sections: ["Group"] }],
    ["equipmentHistory/existing", {
      ...history("web-admin", "stock-moved"),
      createdAt: new Date()
    }]
  ]);
  const db = testEnv.authenticatedContext("web-admin", { email: "admin@example.test" }).firestore();
  await assertFails(updateDoc(doc(db, "equipmentHistory/existing"), { details: "Changed" }));
  await assertFails(deleteDoc(doc(db, "equipmentHistory/existing")));
});

test("parents cannot read equipment history", async () => {
  await seed([["equipmentHistory/existing", { ...history("web-admin"), createdAt: new Date() }]]);
  const db = testEnv.authenticatedContext("parent", { email: "parent@example.test" }).firestore();
  await assertFails(getDoc(doc(db, "equipmentHistory/existing")));
});
