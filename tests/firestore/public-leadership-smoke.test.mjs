import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

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
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "publicLeadership/test-public-leader"), {
      displayName: "Test Public Leader",
      scoutingRole: "Section Leader",
      organisationSection: "Scouts",
      organisationOrder: 10,
      reportsToUid: "",
      active: true,
    });
  });
});

after(async () => {
  await testEnv.cleanup();
});

test("anonymous visitors can list public leadership for About", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(collection(db, "publicLeadership")));
});

test("anonymous visitors can read an individual public leader", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "publicLeadership/test-public-leader")));
});
