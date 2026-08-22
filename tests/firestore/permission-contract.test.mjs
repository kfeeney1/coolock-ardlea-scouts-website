import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) {
      await setDoc(doc(db, path), data);
    }
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

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

test("ordinary leaders must scope join application list queries to assigned sections", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["joinApplications/cub", { section: "Cubs", status: "new" }],
    ["joinApplications/scout", { section: "Scouts", status: "new" }],
  ]);

  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertSucceeds(
    getDocs(query(collection(db, "joinApplications"), where("section", "==", "Cubs")))
  );
  await assertFails(getDocs(collection(db, "joinApplications")));
});

test("ordinary leaders can query both legacy and canonical consent section fields", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["consentApplications/legacy-cub", { scoutSection: "Cubs", status: "active", source: "website" }],
    ["consentApplications/current-cub", { section: "Cubs", scoutSection: "Cubs", status: "active", source: "website" }],
    ["consentApplications/scout", { section: "Scouts", scoutSection: "Scouts", status: "active", source: "website" }],
  ]);

  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertSucceeds(
    getDocs(query(collection(db, "consentApplications"), where("section", "==", "Cubs")))
  );
  await assertSucceeds(
    getDocs(query(collection(db, "consentApplications"), where("scoutSection", "==", "Cubs")))
  );
  await assertFails(getDocs(collection(db, "consentApplications")));
});

test("member lifecycle query uses the same memberId query shape as the UI", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/member-cub", { section: "Cubs", displayName: "Test Cub", status: "active" }],
    ["memberHistory/history-1", {
      memberId: "member-cub",
      memberName: "Test Cub",
      changeType: "status-change",
      fromSection: "Cubs",
      toSection: "Cubs",
      fromStatus: "active",
      toStatus: "inactive",
      changedBy: "leader-cubs",
    }],
  ]);

  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertSucceeds(
    getDocs(query(collection(db, "memberHistory"), where("memberId", "==", "member-cub")))
  );
});

test("member lifecycle query is denied when the referenced member is outside leader scope", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/member-scout", { section: "Scouts", displayName: "Test Scout", status: "active" }],
    ["memberHistory/history-scout", {
      memberId: "member-scout",
      memberName: "Test Scout",
      changeType: "status-change",
      fromSection: "Scouts",
      toSection: "Scouts",
      fromStatus: "active",
      toStatus: "inactive",
      changedBy: "leader-scouts",
    }],
  ]);

  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertFails(
    getDocs(query(collection(db, "memberHistory"), where("memberId", "==", "member-scout")))
  );
});
