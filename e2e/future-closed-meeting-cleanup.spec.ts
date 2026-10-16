import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";
const projectId = process.env.FIREBASE_PROJECT_ID || "demo-coolock-ardlea-scouts";
const ownedIds: string[] = [];
const baselineDocuments: Array<{ path: string; data: FirebaseFirestore.DocumentData }> = [];
const sections = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];

function groupLocalDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function snapshotExistingCandidates(firestore: FirebaseFirestore.Firestore) {
  const today = groupLocalDate();
  const snapshots = await Promise.all(sections.map((section) => firestore.collection("weeklyMeetings")
    .where("section", "==", section).where("status", "==", "closed").where("meetingDate", ">", today).get()));
  const meetings = snapshots.flatMap((snapshot) => snapshot.docs.filter((doc) => {
    const date = doc.get("meetingDate");
    return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > today;
  }));
  const requirements = await Promise.all(meetings.flatMap((meeting) => {
    const entries = meeting.get("entries");
    const memberIds = Array.isArray(entries) ? [...new Set(entries.flatMap((entry) =>
      entry && typeof entry.memberId === "string" ? [entry.memberId] : []))] : [];
    return memberIds.map((memberId) => firestore.collection("memberAdventureSkillProgress").doc(memberId)
      .collection("requirements").where("sourceType", "==", "weeklyMeeting").where("sourceId", "==", meeting.id).get());
  }));
  const paths = new Set<string>();
  const save = (path: string, data: FirebaseFirestore.DocumentData) => {
    if (!paths.has(path)) {
      paths.add(path);
      baselineDocuments.push({ path, data });
    }
  };
  for (const meeting of meetings) {
    save(meeting.ref.path, meeting.data());
    const parent = await firestore.doc(`parentWeeklyMeetings/${meeting.id}`).get();
    if (parent.exists) save(parent.ref.path, parent.data()!);
    const attendance = await meeting.ref.collection("leaderAttendance").get();
    attendance.docs.forEach((record) => save(record.ref.path, record.data()));
  }
  requirements.flatMap((snapshot) => snapshot.docs).forEach((record) => save(record.ref.path, record.data()));
  return meetings.map((meeting) => meeting.id);
}

function db() {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || projectId !== "demo-coolock-ardlea-scouts") {
    throw new Error("Cleanup lifecycle fixtures require the local demo Firestore emulator.");
  }
  return getFirestore(getApps()[0] || initializeApp({ projectId }));
}

test.afterEach(async () => {
  if (!ownedIds.length && !baselineDocuments.length) return;
  const firestore = db();
  for (const id of ownedIds.splice(0)) {
    const batch = firestore.batch();
    batch.delete(firestore.doc(`weeklyMeetings/${id}`));
    batch.delete(firestore.doc(`parentWeeklyMeetings/${id}`));
    batch.delete(firestore.doc(`weeklyMeetings/${id}/leaderAttendance/test.cleanup.leader`));
    batch.delete(firestore.doc("memberAdventureSkillProgress/TEST_member_scout_01/requirements/sw411-cleanup"));
    await batch.commit();
  }
  for (let offset = 0; offset < baselineDocuments.length; offset += 400) {
    const batch = firestore.batch();
    baselineDocuments.slice(offset, offset + 400).forEach(({ path, data }) => batch.set(firestore.doc(path), data));
    await batch.commit();
  }
  baselineDocuments.length = 0;
});

test("administrator reviews, cancels, and confirms deletion of future closed meetings with linked records", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Cleanup is verified once in Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  const firestore = db();
  const existingCandidateIds = await snapshotExistingCandidates(firestore);
  const id = `SW411_${randomUUID().replaceAll("-", "")}`;
  ownedIds.push(id);
  const meeting = {
    section: "Scouts", meetingDate: "2099-10-16", status: "closed", location: "Test den", theme: "Test theme",
    plannedActivities: "[]", plannedBadgework: "[]", programmeNotes: "{}", notes: "", injuries: [],
    entries: [{ memberId: "TEST_member_scout_01", memberName: "Test Scout", attendance: "present", uniform: false, subsPaid: false, subsAmount: 0, badges: [] }],
    createdBy: "test", updatedBy: "test"
  };
  await Promise.all([
    firestore.doc(`weeklyMeetings/${id}`).set(meeting),
    firestore.doc(`parentWeeklyMeetings/${id}`).set({ section: "Scouts", meetingDate: meeting.meetingDate, status: "closed", location: "Test den", theme: "Test theme", activities: [], badgework: [] }),
    firestore.doc(`weeklyMeetings/${id}/leaderAttendance/test.cleanup.leader`).set({ attendance: "present" }),
    firestore.doc("memberAdventureSkillProgress/TEST_member_scout_01/requirements/sw411-cleanup").set({ memberId: "TEST_member_scout_01", requirementId: "sw411-cleanup", skillId: "camping", stage: 1, sharedCompetencyKey: "", completedBy: "test", sourceType: "weeklyMeeting", sourceId: id })
  ]);

  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/weekly");
  const action = page.getByTestId("future-closed-meeting-cleanup");
  await expect(action).toBeVisible();
  await action.click();
  const dialog = page.getByTestId("future-meeting-cleanup-dialog");
  const expectedCount = existingCandidateIds.length + 1;
  await expect(dialog).toContainText(`${expectedCount} closed meeting${expectedCount === 1 ? "" : "s"} dated after today`);
  await expect(dialog).toContainText("attendance, activity and badgework data may also be removed");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect((await firestore.doc(`weeklyMeetings/${id}`).get()).exists).toBe(true);
  expect((await firestore.doc(`parentWeeklyMeetings/${id}`).get()).exists).toBe(true);
  expect((await firestore.doc(`weeklyMeetings/${id}/leaderAttendance/test.cleanup.leader`).get()).exists).toBe(true);
  expect((await firestore.doc("memberAdventureSkillProgress/TEST_member_scout_01/requirements/sw411-cleanup").get()).exists).toBe(true);
  for (const existingId of existingCandidateIds) {
    expect((await firestore.doc(`weeklyMeetings/${existingId}`).get()).exists).toBe(true);
  }

  await action.click();
  await expect(dialog).toContainText(`${expectedCount} closed meeting${expectedCount === 1 ? "" : "s"} dated after today`);
  await dialog.getByTestId("confirm-future-meeting-cleanup").click();
  await expect(dialog).toContainText(`${expectedCount} future-dated closed meeting${expectedCount === 1 ? " was" : "s were"} deleted with associated records.`);
  await expect.poll(async () => (await firestore.doc(`weeklyMeetings/${id}`).get()).exists).toBe(false);
  expect((await firestore.doc(`parentWeeklyMeetings/${id}`).get()).exists).toBe(false);
  expect((await firestore.doc(`weeklyMeetings/${id}/leaderAttendance/test.cleanup.leader`).get()).exists).toBe(false);
  expect((await firestore.doc("memberAdventureSkillProgress/TEST_member_scout_01/requirements/sw411-cleanup").get()).exists).toBe(false);
  for (const existingId of existingCandidateIds) {
    expect((await firestore.doc(`weeklyMeetings/${existingId}`).get()).exists).toBe(false);
  }
});
