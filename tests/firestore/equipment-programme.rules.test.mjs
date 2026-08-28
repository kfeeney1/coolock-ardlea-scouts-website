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

function requirement(uid, section = "Scouts") {
  return {
    sourceType: "event",
    sourceId: "camp-1",
    sourceLabel: "Autumn Camp",
    section,
    date: "2026-09-12",
    lines: [{ itemId: "tent", itemName: "4-person Tent", quantity: 2 }],
    loanId: "",
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
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

test("section leaders can create and update equipment plans for their section", async () => {
  await seed([["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }]]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  const ref = doc(db, "equipmentProgrammeRequirements/event-camp-1");
  await assertSucceeds(setDoc(ref, requirement("scout-leader")));
  await assertSucceeds(updateDoc(ref, { loanId: "reservation-1", updatedBy: "scout-leader", updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(ref));
});

test("leaders cannot plan equipment for another section", async () => {
  await seed([["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }]]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  await assertFails(setDoc(doc(db, "equipmentProgrammeRequirements/event-cubs"), requirement("scout-leader", "Cubs")));
});

test("equipment programme plans preserve creator attribution and reject malformed source types", async () => {
  await seed([
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["equipmentProgrammeRequirements/event-camp-1", {
      ...requirement("scout-leader"),
      createdAt: new Date(),
      updatedAt: new Date(),
    }],
  ]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  const ref = doc(db, "equipmentProgrammeRequirements/event-camp-1");
  await assertFails(updateDoc(ref, { createdBy: "someone-else", updatedBy: "scout-leader", updatedAt: serverTimestamp() }));
  const invalid = requirement("scout-leader");
  invalid.sourceType = "manual";
  await assertFails(setDoc(doc(db, "equipmentProgrammeRequirements/manual-1"), invalid));
});

test("equipment programme plans cannot be deleted and parents cannot read them", async () => {
  await seed([["equipmentProgrammeRequirements/event-camp-1", { ...requirement("scout-leader"), createdAt: new Date(), updatedAt: new Date() }]]);
  const parentDb = testEnv.authenticatedContext("parent", { email: "parent@example.test" }).firestore();
  await assertFails(getDoc(doc(parentDb, "equipmentProgrammeRequirements/event-camp-1")));

  await seed([["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }]]);
  const leaderDb = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  await assertFails(deleteDoc(doc(leaderDb, "equipmentProgrammeRequirements/event-camp-1")));
});
