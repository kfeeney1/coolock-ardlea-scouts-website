import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(records) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const [path, data] of records) await setDoc(doc(context.firestore(), path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080) } });
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed([
    ["adminUsers/admin-1", { active: true, role: "super-admin", sections: ["Beavers"] }],
    ["adminUsers/leader-1", { active: true, role: "leader", sections: ["Beavers"] }],
    ["weeklyMeetings/closed", { section: "Beavers", meetingDate: "2099-01-02", status: "closed", entries: [] }],
    ["weeklyMeetings/open", { section: "Beavers", meetingDate: "2099-01-03", status: "open", entries: [] }],
    ["parentWeeklyMeetings/closed", { section: "Beavers", meetingDate: "2099-01-02", status: "closed" }],
    ["weeklyMeetings/closed/leaderAttendance/leader-1", { attendance: "present" }],
    ["members/member-1", { section: "Beavers", status: "active" }],
    ["memberAdventureSkillProgress/member-1/requirements/requirement-1", { memberId: "member-1", sourceType: "weeklyMeeting", sourceId: "closed" }]
  ]);
});
after(async () => { await testEnv.cleanup(); });

test("active super-admin can remove a closed meeting and its linked records", async () => {
  const db = testEnv.authenticatedContext("admin-1").firestore();
  await assertSucceeds(getDoc(doc(db, "parentWeeklyMeetings/closed")));
  await assertSucceeds(deleteDoc(doc(db, "weeklyMeetings/closed/leaderAttendance/leader-1")));
  await assertSucceeds(deleteDoc(doc(db, "memberAdventureSkillProgress/member-1/requirements/requirement-1")));
  await assertSucceeds(deleteDoc(doc(db, "parentWeeklyMeetings/closed")));
  await assertSucceeds(deleteDoc(doc(db, "weeklyMeetings/closed")));
});

test("section leader and signed-out user cannot delete closed meeting records", async () => {
  const leader = testEnv.authenticatedContext("leader-1").firestore();
  const anonymous = testEnv.unauthenticatedContext().firestore();
  await assertFails(deleteDoc(doc(leader, "weeklyMeetings/closed")));
  await assertFails(deleteDoc(doc(leader, "parentWeeklyMeetings/closed")));
  await assertFails(deleteDoc(doc(anonymous, "weeklyMeetings/closed")));
  await assertFails(deleteDoc(doc(anonymous, "weeklyMeetings/closed/leaderAttendance/leader-1")));
});

test("administrators cannot delete an open meeting", async () => {
  const db = testEnv.authenticatedContext("admin-1").firestore();
  await assertFails(deleteDoc(doc(db, "weeklyMeetings/open")));
});
