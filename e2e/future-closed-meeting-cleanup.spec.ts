import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";
const projectId = process.env.FIREBASE_PROJECT_ID || "demo-coolock-ardlea-scouts";
const ownedIds: string[] = [];

function db() {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || projectId !== "demo-coolock-ardlea-scouts") {
    throw new Error("Cleanup lifecycle fixtures require the local demo Firestore emulator.");
  }
  return getFirestore(getApps()[0] || initializeApp({ projectId }));
}

test.afterEach(async () => {
  if (!ownedIds.length) return;
  const firestore = db();
  for (const id of ownedIds.splice(0)) {
    const batch = firestore.batch();
    batch.delete(firestore.doc(`weeklyMeetings/${id}`));
    batch.delete(firestore.doc(`parentWeeklyMeetings/${id}`));
    batch.delete(firestore.doc(`weeklyMeetings/${id}/leaderAttendance/test.cleanup.leader`));
    batch.delete(firestore.doc("memberAdventureSkillProgress/TEST_member_scout_01/requirements/sw411-cleanup"));
    await batch.commit();
  }
});

test("administrator reviews, cancels, and confirms deletion of future closed meetings with linked records", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Cleanup is verified once in Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  const firestore = db();
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
  await expect(dialog).toContainText("1 closed meeting dated after today");
  await expect(dialog).toContainText("attendance, activity and badgework data may also be removed");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect((await firestore.doc(`weeklyMeetings/${id}`).get()).exists).toBe(true);
  expect((await firestore.doc(`parentWeeklyMeetings/${id}`).get()).exists).toBe(true);

  await action.click();
  await expect(dialog).toContainText("1 closed meeting dated after today");
  await dialog.getByTestId("confirm-future-meeting-cleanup").click();
  await expect(dialog).toContainText("1 future-dated closed meeting was deleted with associated records.");
  await expect.poll(async () => (await firestore.doc(`weeklyMeetings/${id}`).get()).exists).toBe(false);
  expect((await firestore.doc(`parentWeeklyMeetings/${id}`).get()).exists).toBe(false);
  expect((await firestore.doc(`weeklyMeetings/${id}/leaderAttendance/test.cleanup.leader`).get()).exists).toBe(false);
  expect((await firestore.doc("memberAdventureSkillProgress/TEST_member_scout_01/requirements/sw411-cleanup").get()).exists).toBe(false);
});
