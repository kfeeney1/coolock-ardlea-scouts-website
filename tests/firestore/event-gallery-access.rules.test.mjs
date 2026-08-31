import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

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

beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

test("parents cannot forge or read event gallery access projections", async () => {
  const db = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  const projection = doc(db, "eventGalleryAccess/event-1/parents/parent-1");
  await assertFails(setDoc(projection, {
    eventId: "event-1",
    section: "Cubs",
    parentUid: "parent-1",
    memberId: "member-1",
    consentApplicationId: "consent-1",
    active: true,
  }));
  await assertFails(getDoc(projection));
});

test("leaders cannot forge event gallery access projections", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "adminUsers/leader-cubs"), {
      active: true,
      role: "leader",
      sections: ["Cubs"],
    });
  });
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();
  await assertFails(setDoc(doc(db, "eventGalleryAccess/event-1/parents/parent-1"), {
    eventId: "event-1",
    section: "Cubs",
    parentUid: "parent-1",
    memberId: "member-1",
    consentApplicationId: "consent-1",
    active: true,
  }));
});
