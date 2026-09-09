import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed([
    ["adminUsers/admin", { active: true, role: "admin", sections: ["Group"], displayName: "Admin", email: "admin@example.com" }],
    ["adminUsers/super", { active: true, role: "super-admin", sections: ["Group"], displayName: "Super", email: "super@example.com" }],
    ["adminUsers/leader", { active: true, role: "leader", sections: ["Cubs"], displayName: "Leader", email: "leader@example.com" }],
    ["adminUsers/other-super", { active: true, role: "super-admin", sections: ["Group"], displayName: "Other Super", email: "other-super@example.com" }]
  ]);
});

after(async () => testEnv.cleanup());

test("Admin cannot promote a leader to Admin", async () => {
  const db = testEnv.authenticatedContext("admin").firestore();
  await assertFails(updateDoc(doc(db, "adminUsers/leader"), {
    role: "admin",
    updatedAt: serverTimestamp(),
    updatedBy: "admin"
  }));
});

test("Super Admin can promote a non-Super-Admin leader to Admin", async () => {
  const db = testEnv.authenticatedContext("super").firestore();
  await assertSucceeds(updateDoc(doc(db, "adminUsers/leader"), {
    role: "admin",
    updatedAt: serverTimestamp(),
    updatedBy: "super"
  }));
});

test("no Super Admin can alter another protected Super Admin through adminUsers", async () => {
  const db = testEnv.authenticatedContext("super").firestore();
  await assertFails(updateDoc(doc(db, "adminUsers/other-super"), {
    active: false,
    updatedAt: serverTimestamp(),
    updatedBy: "super"
  }));
});
