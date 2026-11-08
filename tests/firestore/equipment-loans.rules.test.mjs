import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mutateEquipmentOption } from "../../functions/src/equipmentOptions.js";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

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
  await assertFails(setDoc(doc(db, "equipmentItems/unauthorised-item"), {
    ...item,
    createdBy: "scout-leader",
    createdAt: serverTimestamp(),
    updatedBy: "scout-leader",
    updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(db, "equipmentCategories/unauthorised-category"), {
    name: "Unauthorised category",
    createdBy: "scout-leader",
    createdAt: serverTimestamp()
  }));
});

// Even privileged catalogue managers must explicitly identify the borrower.
test("checkout rejects missing, empty and whitespace sections at the persistence boundary", async () => {
  await seed([["adminUsers/qm", { active: true, role: "admin", sections: ["Group"] }]]);
  const db = testEnv.authenticatedContext("qm").firestore();
  for (const section of ["", " ", "\t\n"]) {
    await assertFails(setDoc(doc(db, "equipmentLoans/invalid-section"), loan("qm", section)));
  }
  const missingSection = loan("qm");
  delete missingSection.section;
  await assertFails(setDoc(doc(db, "equipmentLoans/missing-section"), missingSection));
  await assertSucceeds(setDoc(doc(db, "equipmentLoans/valid-section"), loan("qm", "Scouts")));
});

test("Store rename commits matched assignments and history together for authorized managers", async () => {
  const store = { id: "main", name: "Main Store" };
  await seed([
    ["adminUsers/qm", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/qm", { active: true, scoutingRole: "Group Quartermaster" }],
    ["adminUsers/scouter", { active: true, role: "leader", sections: ["Scouts"] }],
    ["equipmentLocations/main", { name: store.name, createdBy: "qm", createdAt: new Date() }],
    ["equipmentItems/active", item],
    ["equipmentItems/archived", { ...item, archived: true, location: "main  store" }],
    ["equipmentItems/other", { ...item, location: "Other Store" }],
    ["equipmentHistory/original", { fromLocation: "Main Store", toLocation: "Main Store" }]
  ]);
  const db = testEnv.authenticatedContext("qm").firestore();
  const adminApp = initializeApp({ projectId }, "equipment-option-mutation");
  const server = getFirestore(adminApp);
  const rename = uid => mutateEquipmentOption(server, uid, {
    kind: "locations", id: store.id, expectedName: store.name, action: "rename", name: "Side Store"
  });
  const remove = expectedName => mutateEquipmentOption(server, "qm", {
    kind: "locations", id: store.id, expectedName, action: "delete"
  });
  try {
    const location = id => doc(db, "equipmentItems", id);
    await assert.rejects(rename("scouter"), { code: "permission-denied" });
    await assert.rejects(remove("Main Store"), /Equipment still uses/);
    assert.equal((await getDoc(doc(db, "equipmentLocations/main"))).get("name"), "Main Store");
    assert.equal((await getDoc(location("active"))).get("location"), "Main Store");
    assert.equal((await getDocs(collection(db, "equipmentHistory"))).size, 1);

    assert.deepEqual(await rename("qm"), { changed: 2 });
    assert.equal((await getDoc(doc(db, "equipmentLocations/main"))).get("name"), "Side Store");
    assert.equal((await getDoc(location("active"))).get("location"), "Side Store");
    assert.equal((await getDoc(location("archived"))).get("location"), "Side Store");
    assert.equal((await getDoc(location("other"))).get("location"), "Other Store");
    const history = await getDocs(collection(db, "equipmentHistory"));
    assert.equal(history.size, 3);
    assert.equal(history.docs.find(record => record.id === "original").get("toLocation"), "Main Store");
    await assert.rejects(rename("qm"), /option changed/);
    assert.equal((await getDocs(collection(db, "equipmentHistory"))).size, 3);
    await assertFails(updateDoc(location("other"), { location: " MAIN  Store ", updatedBy: "qm", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(location("active"), { location: "Other Store", updatedBy: "qm", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(location("archived"), { location: "Other Store", updatedBy: "qm", updatedAt: serverTimestamp() }));
    await remove("Side Store");
    assert.equal((await server.doc("equipmentOptionRetirements/locations").get()).get("names")["label:side store"], true);
    await assertFails(getDoc(doc(db, "equipmentOptionRetirements/locations")));
    assert.equal((await getDoc(doc(db, "equipmentLocations/main"))).exists(), false);
    await assertFails(updateDoc(location("other"), { location: "Side Store", updatedBy: "qm", updatedAt: serverTimestamp() }));
  } finally {
    await deleteApp(adminApp);
  }
});

test("deletion and a concurrent first assignment cannot both commit", async () => {
  const name = "Concurrent Store";
  await seed([
    ["adminUsers/manager", { active: true, role: "admin", sections: ["Group"] }],
    ["equipmentLocations/concurrent", { name, createdBy: "manager", createdAt: new Date() }]
  ]);
  const db = testEnv.authenticatedContext("manager").firestore();
  const adminApp = initializeApp({ projectId }, "equipment-option-race");
  try {
    const assignment = doc(db, "equipmentItems/concurrent");
    const [deletion, creation] = await Promise.allSettled([
      mutateEquipmentOption(getFirestore(adminApp), "manager", {
        kind: "locations", id: "concurrent", expectedName: name, action: "delete"
      }),
      setDoc(assignment, {
        ...item, location: name, createdBy: "manager", updatedBy: "manager",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      })
    ]);
    assert.notEqual(deletion.status, creation.status);
    assert.equal((await getDoc(assignment)).exists(), creation.status === "fulfilled");
    assert.equal((await getDoc(doc(db, "equipmentLocations/concurrent"))).exists(), creation.status === "fulfilled");
  } finally {
    await deleteApp(adminApp);
  }
});
