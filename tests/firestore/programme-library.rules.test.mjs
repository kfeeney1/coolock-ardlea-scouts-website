import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

const template = {
  kind: "activity",
  section: "Scouts",
  name: "Capture the Flag",
  leader: "All leaders",
  notes: "Use the full hall.",
  equipment: "Cones",
  durationMinutes: 20,
  createdBy: "leader-scouts",
  createdAt: serverTimestamp(),
  updatedBy: "leader-scouts",
  updatedAt: serverTimestamp(),
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

beforeEach(async () => { await testEnv.clearFirestore(); });
after(async () => { await testEnv.cleanup(); });

test("programme library is section scoped for leaders", async () => {
  await seed([
    ["adminUsers/leader-scouts", { active: true, role: "leader", sections: ["Scouts"] }],
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
  ]);
  const scouts = testEnv.authenticatedContext("leader-scouts").firestore();
  const cubs = testEnv.authenticatedContext("leader-cubs").firestore();
  const ref = doc(scouts, "programmeLibrary/template-1");
  await assertSucceeds(setDoc(ref, template));
  await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(cubs, "programmeLibrary/template-1")));
});

test("programme library queries must stay inside the leader section", async () => {
  await seed([
    ["adminUsers/leader-scouts", { active: true, role: "leader", sections: ["Scouts"] }],
    ["programmeLibrary/template-1", { ...template, createdAt: new Date(), updatedAt: new Date() }],
    ["programmeLibrary/template-cubs", { ...template, section: "Cubs", createdAt: new Date(), updatedAt: new Date() }],
  ]);
  const db = testEnv.authenticatedContext("leader-scouts").firestore();
  await assertSucceeds(getDocs(query(collection(db, "programmeLibrary"), where("section", "==", "Scouts"))));
  await assertFails(getDocs(collection(db, "programmeLibrary")));
  await assertFails(getDocs(query(collection(db, "programmeLibrary"), where("section", "==", "Cubs"))));
});

test("unauthenticated users cannot read programme templates", async () => {
  await seed([["programmeLibrary/template-1", { ...template, createdAt: new Date(), updatedAt: new Date() }]]);
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "programmeLibrary/template-1")));
});

test("leaders cannot delete another section programme template", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["programmeLibrary/template-1", { ...template, createdAt: new Date(), updatedAt: new Date() }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertFails(deleteDoc(doc(db, "programmeLibrary/template-1")));
});