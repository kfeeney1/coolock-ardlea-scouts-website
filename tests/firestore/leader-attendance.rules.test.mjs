import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

const leaderDoc = (name) => ({ displayName: name, active: true, scoutingRole: "Section Leader", organisationSection: "Cubs", organisationOrder: 1, reportsToUid: "", showPublicly: false });
const attendanceDoc = (name = "Active Leader") => ({ displayName: name, appointments: ["Section Leader"], sections: ["Cubs"], attendance: "present", updatedBy: "leader-cubs", updatedAt: serverTimestamp() });

before(async () => { testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080) } }); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/leader-scouts", { active: true, role: "leader", sections: ["Scouts"] }],
    ["adminUsers/inactive-leader", { active: false, role: "leader", sections: ["Cubs"] }],
    ["organisationLeadership/leader-cubs", leaderDoc("Cubs Leader")],
    ["organisationLeadership/leader-scouts", { ...leaderDoc("Scouts Leader"), organisationSection: "Scouts" }],
    ["organisationLeadership/inactive-leader", { ...leaderDoc("Inactive Leader"), active: false }],
    ["weeklyMeetings/weekly-cubs", { section: "Cubs", meetingDate: "2099-03-01", entries: [], injuries: [], notes: "private" }],
    ["events/event-cubs", { section: "Cubs", title: "Cubs event" }]
  ]);
});
after(async () => { await testEnv.cleanup(); });

test("section organisers can record an active leader by UID for meetings and events", async () => {
  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertSucceeds(setDoc(doc(db, "weeklyMeetings/weekly-cubs/leaderAttendance/leader-scouts"), attendanceDoc("Scouts Leader")));
  await assertSucceeds(setDoc(doc(db, "events/event-cubs/leaderAttendance/leader-scouts"), attendanceDoc("Scouts Leader")));
  await assertSucceeds(getDoc(doc(db, "weeklyMeetings/weekly-cubs/leaderAttendance/leader-scouts")));
});

test("leaders outside the activity scope cannot read or write leader attendance", async () => {
  const db = testEnv.authenticatedContext("leader-scouts").firestore();
  await assertFails(getDoc(doc(db, "weeklyMeetings/weekly-cubs/leaderAttendance/leader-scouts")));
  await assertFails(setDoc(doc(db, "events/event-cubs/leaderAttendance/leader-scouts"), {
    ...attendanceDoc("Scouts Leader"), updatedBy: "leader-scouts"
  }));
});

test("attendance writes reject inactive leaders and forged identity details", async () => {
  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertFails(setDoc(doc(db, "weeklyMeetings/weekly-cubs/leaderAttendance/inactive-leader"), attendanceDoc("Inactive Leader")));
  await assertFails(setDoc(doc(db, "events/event-cubs/leaderAttendance/leader-scouts"), attendanceDoc("Forged Name")));
});
