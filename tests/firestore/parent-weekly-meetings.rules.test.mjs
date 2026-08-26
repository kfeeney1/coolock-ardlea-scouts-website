import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
beforeEach(async () => { await testEnv.clearFirestore(); });
after(async () => { await testEnv.cleanup(); });

const safeProgramme = {
  section: "Beavers",
  meetingDate: "2099-02-01",
  status: "open",
  location: "Scout Den",
  theme: "Friendship",
  activities: [{ name: "Opening game", durationMinutes: 15 }],
  badgework: [{ name: "Adventure Skills", durationMinutes: 30 }],
  updatedAt: serverTimestamp(),
};

test("section leaders can publish only the parent-safe weekly projection shape", async () => {
  await seed([["adminUsers/leader-beavers", { active: true, role: "leader", sections: ["Beavers"] }]]);
  const db = testEnv.authenticatedContext("leader-beavers").firestore();
  await assertSucceeds(setDoc(doc(db, "parentWeeklyMeetings/meeting-1"), safeProgramme));
  await assertFails(setDoc(doc(db, "parentWeeklyMeetings/leaky"), { ...safeProgramme, injuries: [{ concern: "private" }] }));
});

test("approved parents can query their linked section projection but cannot read raw weekly meetings", async () => {
  await seed([
    ["parentAccounts/parent-beavers", { status: "approved", memberIds: ["member-1"], linkedSections: ["Beavers"] }],
    ["parentWeeklyMeetings/beaver", { ...safeProgramme, updatedAt: new Date() }],
    ["parentWeeklyMeetings/scout", { ...safeProgramme, section: "Scouts", updatedAt: new Date() }],
    ["weeklyMeetings/beaver", { section: "Beavers", meetingDate: "2099-02-01", entries: [], injuries: [], notes: "private" }],
  ]);
  const db = testEnv.authenticatedContext("parent-beavers").firestore();
  await assertSucceeds(getDocs(query(collection(db, "parentWeeklyMeetings"), where("section", "==", "Beavers"))));
  await assertFails(getDocs(query(collection(db, "parentWeeklyMeetings"), where("section", "==", "Scouts"))));
  await assertFails(getDoc(doc(db, "weeklyMeetings/beaver")));
});

test("pending parents cannot read weekly programme projections", async () => {
  await seed([
    ["parentAccounts/parent-pending", { status: "pending", memberIds: [], linkedSections: [] }],
    ["parentWeeklyMeetings/beaver", { ...safeProgramme, updatedAt: new Date() }],
  ]);
  const db = testEnv.authenticatedContext("parent-pending").firestore();
  await assertFails(getDocs(query(collection(db, "parentWeeklyMeetings"), where("section", "==", "Beavers"))));
});
