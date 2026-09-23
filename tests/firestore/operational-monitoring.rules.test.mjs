import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "operationalMonitoring/firestore-backup-production"), {
      service: "Firestore Backup",
      environment: "production",
      state: "Healthy",
      observedAt: "2026-09-23T12:00:00.000Z",
    });
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
  await seed();
});
after(async () => testEnv.cleanup());

test("Super Admin can read operationalMonitoring", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "adminUsers/super-1"), { active: true, role: "super-admin" });
  });
  const db = testEnv.authenticatedContext("super-1", { email: "super@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "operationalMonitoring/firestore-backup-production")));
  await assertSucceeds(getDocs(collection(db, "operationalMonitoring")));
});

test("ordinary leaders cannot read operationalMonitoring", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "adminUsers/leader-1"), { active: true, role: "leader", sections: ["Cubs"] });
  });
  const db = testEnv.authenticatedContext("leader-1", { email: "leader@example.com" }).firestore();
  await assertFails(getDoc(doc(db, "operationalMonitoring/firestore-backup-production")));
  await assertFails(getDocs(collection(db, "operationalMonitoring")));
});

test("parents and unauthenticated users cannot read operationalMonitoring", async () => {
  const parentDb = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  const publicDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(parentDb, "operationalMonitoring/firestore-backup-production")));
  await assertFails(getDoc(doc(publicDb, "operationalMonitoring/firestore-backup-production")));
});

test("clients cannot write operationalMonitoring, including Super Admin", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "adminUsers/super-1"), { active: true, role: "super-admin" });
  });
  const db = testEnv.authenticatedContext("super-1", { email: "super@example.com" }).firestore();
  await assertFails(setDoc(doc(db, "operationalMonitoring/client-write"), { state: "Healthy" }));
});
