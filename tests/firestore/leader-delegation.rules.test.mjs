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

const access = (role, sections = ["Group"]) => ({ active: true, role, sections, displayName: role, email: `${role}@example.com` });
const organisation = (scoutingRole, section = "Group") => ({ displayName: scoutingRole, scoutingRole, organisationSection: section, organisationOrder: 1, reportsToUid: "", showPublicly: false, active: true, updatedAt: new Date(0) });

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed([
    ["adminUsers/gl", access("leader")],
    ["adminUsers/dgl", access("leader")],
    ["adminUsers/ordinary", access("leader", ["Cubs"])],
    ["adminUsers/admin", access("admin")],
    ["adminUsers/super", access("super-admin")],
    ["organisationLeadership/gl", organisation("Group Leader")],
    ["organisationLeadership/dgl", organisation("Deputy Group Leader")],
    ["organisationLeadership/ordinary", organisation("Scouter", "Cubs")],
    ["organisationLeadership/admin", organisation("Group Chairperson")],
    ["organisationLeadership/super", organisation("Group Chairperson")],
    ["publicLeadership/ordinary", { ...organisation("Scouter", "Cubs"), showPublicly: true, publicProjectionVersion: 2, sourceAccessRole: "leader" }]
  ]);
});

after(async () => testEnv.cleanup());

for (const actor of ["gl", "dgl"]) {
  test(`${actor} can delegate ordinary section scope but cannot change system access`, async () => {
    const db = testEnv.authenticatedContext(actor, { email: `${actor}@example.com` }).firestore();
    await assertSucceeds(updateDoc(doc(db, "adminUsers/ordinary"), { sections: ["Cubs", "Scouts"], updatedAt: serverTimestamp(), updatedBy: actor }));
    await assertFails(updateDoc(doc(db, "adminUsers/ordinary"), { active: false, updatedAt: serverTimestamp(), updatedBy: actor }));
    await assertFails(updateDoc(doc(db, "adminUsers/ordinary"), { role: "admin", updatedAt: serverTimestamp(), updatedBy: actor }));
  });

  test(`${actor} can assign ordinary appointments but not privileged group appointments`, async () => {
    const db = testEnv.authenticatedContext(actor, { email: `${actor}@example.com` }).firestore();
    await assertSucceeds(updateDoc(doc(db, "organisationLeadership/ordinary"), { scoutingRole: "Section Leader", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "organisationLeadership/ordinary"), { scoutingRole: "Group Treasurer", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "organisationLeadership/ordinary"), { scoutingRole: "Deputy Group Leader", updatedAt: serverTimestamp() }));
  });
}

test("Group Leadership cannot self-edit or target protected system roles", async () => {
  const db = testEnv.authenticatedContext("gl", { email: "gl@example.com" }).firestore();
  await assertFails(updateDoc(doc(db, "adminUsers/gl"), { sections: ["Group", "Cubs"], updatedAt: serverTimestamp(), updatedBy: "gl" }));
  await assertFails(updateDoc(doc(db, "adminUsers/admin"), { sections: ["Group", "Cubs"], updatedAt: serverTimestamp(), updatedBy: "gl" }));
  await assertFails(updateDoc(doc(db, "organisationLeadership/admin"), { scoutingRole: "Scouter", updatedAt: serverTimestamp() }));
});

test("Admin may assign privileged Scouting appointments but cannot promote system access", async () => {
  const db = testEnv.authenticatedContext("admin", { email: "admin@example.com" }).firestore();
  await assertSucceeds(updateDoc(doc(db, "organisationLeadership/ordinary"), { scoutingRole: "Group Treasurer", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "adminUsers/ordinary"), { role: "admin", updatedAt: serverTimestamp(), updatedBy: "admin" }));
});

test("Super Admin remains the only actor able to change another ordinary system role", async () => {
  const db = testEnv.authenticatedContext("super", { email: "super@example.com" }).firestore();
  await assertSucceeds(updateDoc(doc(db, "adminUsers/ordinary"), { role: "admin", updatedAt: serverTimestamp(), updatedBy: "super" }));
});

test("Group Leadership can keep an existing public projection appointment aligned without controlling visibility", async () => {
  const db = testEnv.authenticatedContext("gl", { email: "gl@example.com" }).firestore();
  await assertSucceeds(updateDoc(doc(db, "publicLeadership/ordinary"), { scoutingRole: "Section Leader", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "publicLeadership/ordinary"), { showPublicly: false, updatedAt: serverTimestamp() }));
});
