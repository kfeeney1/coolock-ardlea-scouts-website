import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";

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
    firestore: {
      rules: await readFile("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

function publicLeadershipQuery(db) {
  return query(
    collection(db, "publicLeadership"),
    where("publicProjectionVersion", "==", 2),
    where("sourceAccessRole", "==", "leader"),
    where("active", "==", true),
    where("showPublicly", "==", true)
  );
}

test("active leaders can list the internal organisational chart", async () => {
  await seed([
    ["adminUsers/leader-1", { active: true, role: "leader", sections: ["Cubs"] }],
    ["organisationLeadership/leader-1", { displayName: "Test Leader", scoutingRole: "Section Leader", organisationSection: "Cubs", organisationOrder: 10, reportsToUid: "", showPublicly: false, active: true }],
  ]);
  const db = testEnv.authenticatedContext("leader-1", { email: "leader@example.com" }).firestore();
  await assertSucceeds(getDocs(collection(db, "organisationLeadership")));
});

test("authenticated non-leaders cannot list the internal organisational chart", async () => {
  await seed([["organisationLeadership/leader-1", { displayName: "Test Leader", scoutingRole: "Section Leader", organisationSection: "Cubs", organisationOrder: 10, reportsToUid: "", showPublicly: false, active: true }]]);
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertFails(getDocs(collection(db, "organisationLeadership")));
});

test("public visitors can list only the current public leadership projection", async () => {
  await seed([
    ["publicLeadership/leader-1", {
      displayName: "Public Leader",
      scoutingRole: "Group Leader",
      organisationSection: "Group",
      organisationOrder: 1,
      reportsToUid: "",
      showPublicly: true,
      active: true,
      sourceAccessRole: "leader",
      publicProjectionVersion: 2,
    }],
    ["organisationLeadership/leader-1", { displayName: "Internal Leader", scoutingRole: "Group Leader", organisationSection: "Group", organisationOrder: 1, reportsToUid: "", showPublicly: true, active: true }],
  ]);
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(publicLeadershipQuery(db)));
  await assertFails(getDocs(collection(db, "publicLeadership")));
  await assertFails(getDocs(collection(db, "organisationLeadership")));
});
