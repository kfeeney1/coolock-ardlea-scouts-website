import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: "coolock-ardlea-scouts", firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080) } }); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "adminUsers/matrix-leader"), { active: true, role: "leader", sections: ["Cubs"] });
    await setDoc(doc(db, "organisationLeadership/matrix-leader"), { active: true, scoutingRole: "Section Leader", organisationSection: "Cubs" });
    for (const section of ["Cubs", "Scouts"]) {
      await setDoc(doc(db, `weeklyMeetings/${section}`), { section, meetingDate: "2026-10-01", status: "closed", entries: [{ memberId: section, attendance: "present" }] });
      await setDoc(doc(db, `members/${section}`), { section, sections: [section], status: "active", displayName: section });
    }
  });
});
test("matrix source reads enforce section scope for IDs and tampered query payloads", async () => {
  const db = env.authenticatedContext("matrix-leader").firestore();
  for (const name of ["weeklyMeetings", "members"]) {
    await assertSucceeds(getDoc(doc(db, name, "Cubs")));
    await assertSucceeds(getDocs(query(collection(db, name), where("section", "==", "Cubs"))));
    await assertFails(getDoc(doc(db, name, "Scouts")));
    await assertFails(getDocs(query(collection(db, name), where("section", "==", "Scouts"))));
    await assertFails(getDocs(collection(db, name)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), name, "Cubs")));
  }
});
