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
  serverTimestamp,
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

test("ordinary leaders can query canonical consent section fields and legacy section aliases are denied", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["consentApplications/current-cub", { section: "Cubs", formType: "youth-activity-consent", status: "active", source: "website" }],
    ["consentApplications/scout", { section: "Scouts", formType: "youth-activity-consent", status: "active", source: "website" }],
    ["consentApplications/legacy-cub", { scoutSection: "Cubs", formType: "youth", status: "active", source: "website" }],
  ]);

  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertSucceeds(
    getDocs(query(collection(db, "consentApplications"), where("section", "==", "Cubs")))
  );
  await assertFails(
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

test("audit log writes bind actor email to the authenticated identity and known categories", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
  ]);

  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader-cubs@example.com" }).firestore();
  const canonical = {
    actorUid: "leader-cubs",
    actorEmail: "leader-cubs@example.com",
    category: "member",
    action: "member-updated",
    targetId: "member-cub",
    targetLabel: "Test Cub",
    description: "Updated member record",
    section: "Cubs",
    createdAt: serverTimestamp(),
  };

  await assertSucceeds(setDoc(doc(db, "auditLog/canonical"), canonical));
  await assertFails(setDoc(doc(db, "auditLog/forged-email"), {
    ...canonical,
    actorEmail: "someone-else@example.com",
  }));
  await assertFails(setDoc(doc(db, "auditLog/unknown-category"), {
    ...canonical,
    category: "made-up-category",
  }));
});

test("Activity Log is readable by Group Leader and Group Secretary but not ordinary leaders", async () => {
  await seed([
    ["adminUsers/group-leader", { active: true, role: "leader", sections: ["Group"] }],
    ["adminUsers/group-secretary", { active: true, role: "leader", sections: ["Group"] }],
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["organisationLeadership/group-leader", {
      active: true,
      scoutingRole: "Group Leader",
      displayName: "Test Group Leader",
      organisationSection: "Group",
      organisationOrder: 1,
      reportsToUid: "",
      showPublicly: true,
    }],
    ["organisationLeadership/group-secretary", {
      active: true,
      scoutingRole: "Group Secretary",
      displayName: "Test Group Secretary",
      organisationSection: "Group",
      organisationOrder: 2,
      reportsToUid: "group-leader",
      showPublicly: true,
    }],
    ["auditLog/example", {
      actorUid: "leader-cubs",
      actorEmail: "leader-cubs@example.com",
      category: "member",
      action: "member-updated",
      targetId: "member-cub",
      targetLabel: "Test Cub",
      description: "Updated member record",
      section: "Cubs",
      createdAt: new Date("2026-08-26T12:00:00Z"),
    }],
  ]);

  const groupLeaderDb = testEnv.authenticatedContext("group-leader").firestore();
  const groupSecretaryDb = testEnv.authenticatedContext("group-secretary").firestore();
  const ordinaryLeaderDb = testEnv.authenticatedContext("leader-cubs").firestore();

  await assertSucceeds(getDocs(collection(groupLeaderDb, "auditLog")));
  await assertSucceeds(getDocs(collection(groupSecretaryDb, "auditLog")));
  await assertFails(getDocs(collection(ordinaryLeaderDb, "auditLog")));
});
