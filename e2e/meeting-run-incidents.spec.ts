import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { waitForTransientOverlayHistory } from "./helpers/transientOverlayHistory";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { reconcileOpenWeeklyRoster } from "../src/services/weeklyTrackerLogic";
const id = "000-sw422-run";
const password = process.env.E2E_TEST_USER_PASSWORD;
async function enter(page: Page) {
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
  await page.goto(`/leader/weekly?meeting=${id}`); await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Run meeting", exact: true })).toBeVisible();
}
async function draft(page: Page, concern = "Synthetic concern") {
  await page.getByRole("combobox", { name: "Incident member" }).click(); const member = await page.getByRole("option").first().textContent(); await page.getByRole("option").first().click();
  await expect(page.getByRole("combobox", { name: "Incident member" })).toContainText(member!);
  await waitForTransientOverlayHistory(page);
  await page.getByRole("textbox", { name: "Injury / medical concern" }).fill(concern);
  await page.getByRole("textbox", { name: "Action taken" }).fill("Synthetic first aid");
  await page.getByRole("checkbox", { name: "Parent informed", exact: true }).check();
}
test.beforeEach(async () => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const db = scheduleFixtureDb(); await db.doc("siteSettings/meetingExperience").set({ version: "redesigned" });
  const members = (await db.collection("members").get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const entries = reconcileOpenWeeklyRoster([], members as Parameters<typeof reconcileOpenWeeklyRoster>[1], "Scouts");
  await db.doc(`weeklyMeetings/${id}`).set({ section: "Scouts", meetingDate: "2099-07-22", status: "open", location: "Synthetic den", programmeNotes: JSON.stringify({ marker: "weekly-programme-v1", theme: "Run fixture", notes: "Programme reference notes" }), plannedActivities: JSON.stringify({ marker: "weekly-activities-v1", items: [{ id: "one", activity: "Reference game", leader: "Guest reference leader", equipment: "Cones", notes: "Reference instructions", durationMinutes: 20 }] }), plannedBadgework: JSON.stringify({ marker: "weekly-badgework-v1", items: [] }), entries, injuries: [], notes: "", testData: true });
});
test.afterEach(async ({ page }) => {
  await page.context().setOffline(false); const db = scheduleFixtureDb();
  for (const child of (await db.collection(`weeklyMeetings/${id}/leaderAttendance`).get()).docs) await child.ref.delete();
  for (const path of [`weeklyMeetings/${id}`, `parentWeeklyMeetings/${id}`, "siteSettings/meetingExperience"]) await db.doc(path).delete();
});
test("Run retains attendance invariants and draft fields across stages and programme reference", async ({ page }) => {
  await enter(page); const row = page.getByTestId("attendance-list").getByRole("row").nth(1);
  const attendance = row.getByRole("checkbox", { name: /^Attendance/ }); const uniform = row.getByRole("checkbox", { name: /^Uniform/ });
  await uniform.check(); await expect(attendance).toBeChecked(); await attendance.uncheck(); await expect(uniform).not.toBeChecked();
  await page.getByRole("button", { name: "Mark all present", exact: true }).click(); await expect(attendance).toBeChecked();
  await draft(page); await page.getByRole("button", { name: "View programme", exact: true }).click();
  const reference = page.getByRole("dialog", { name: "Programme reference" }); await expect(reference).toContainText("Reference instructions"); await expect(reference).toContainText("Guest reference leader"); await expect(reference).toContainText("Cones");
  await reference.getByRole("button", { name: "Back to attendance" }).click();
  await expect(reference).toBeHidden();
  // Closing the reference also consumes its asynchronous Back-history entry.
  // Finish that transition before changing stages or clearing the incident guard.
  await waitForTransientOverlayHistory(page);
  await expect(page).toHaveURL(new RegExp(`meeting=${id}$`));
  await expect(attendance).toBeChecked();
  await page.getByRole("button", { name: "Review", exact: true }).click(); await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Injury / medical concern" })).toHaveValue("Synthetic concern");
  await page.getByRole("button", { name: "Add incident to draft", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Incident added" })).toBeVisible();
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click(); await expect(page.getByTestId("meeting-save-state")).toHaveText("Saved");
  const stored = (await scheduleFixtureDb().doc(`weeklyMeetings/${id}`).get()).data()!; expect(stored.injuries).toHaveLength(1); expect(stored.injuries[0]).toMatchObject({ concern: "Synthetic concern", actionTaken: "Synthetic first aid", parentInformed: true, severity: "minor" }); expect(Number.isFinite(Date.parse(stored.injuries[0].recordedAt))).toBe(true);
  await page.reload(); await page.getByRole("button", { name: "Run", exact: true }).click(); await expect(page.getByText(/Recorded: \d{2}-\d{2}-\d{4}/)).toBeVisible();
});
test("Incomplete incident blocks Save and sharing, retaining fields; valid share saves incident once", async ({ page }) => {
  await enter(page); await page.getByRole("textbox", { name: "Action taken" }).fill("Incomplete action");
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click(); await expect(page.getByRole("alert").filter({ hasText: "Select a member" })).toBeVisible();
  await page.getByRole("button", { name: "Plan", exact: true }).click(); await page.getByRole("button", { name: "Share programme", exact: true }).click();
  const share = page.getByRole("dialog", { name: "Share programme", exact: true }); await expect(share.getByRole("alert")).toBeVisible(); await expect(share.getByRole("link")).toHaveCount(0); await share.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click(); await expect(page.getByRole("textbox", { name: "Action taken" })).toHaveValue("Incomplete action");
  await draft(page, "PRIVATE incident"); await page.getByRole("button", { name: "Plan", exact: true }).click(); await page.getByRole("button", { name: "Share programme", exact: true }).click();
  await expect(share.getByRole("link", { name: "Share in WhatsApp", exact: true })).toBeVisible(); expect(await share.getByRole("link").getAttribute("href")).not.toContain("PRIVATE");
  expect((await scheduleFixtureDb().doc(`weeklyMeetings/${id}`).get()).get("injuries")).toHaveLength(1);
});
test("Incident leave guard supports Stay, failed Save, successful Save and Discard without silent loss", async ({ page }) => {
  await enter(page); await page.getByRole("textbox", { name: "Injury / medical concern" }).fill("Incomplete draft");
  await waitForTransientOverlayHistory(page); await page.goBack();
  const leave = page.getByRole("dialog", { name: "Unsaved incident form", exact: true }); await expect(leave).toBeVisible(); await leave.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Injury / medical concern" })).toHaveValue("Incomplete draft");
  await waitForTransientOverlayHistory(page); await page.goBack(); await leave.getByRole("button", { name: "Save", exact: true }).click(); await expect(leave).toBeHidden(); await expect(page.getByRole("alert").filter({ hasText: "Select a member" })).toBeVisible();
  await draft(page); await waitForTransientOverlayHistory(page); await page.goBack(); await leave.getByRole("button", { name: "Save", exact: true }).click(); await expect(page).not.toHaveURL(new RegExp(`meeting=${id}`));
  expect((await scheduleFixtureDb().doc(`weeklyMeetings/${id}`).get()).get("injuries")).toHaveLength(1);
  await page.goto(`/leader/weekly?meeting=${id}`); await page.getByRole("button", { name: "Run", exact: true }).click(); await draft(page, "Discarded concern"); await waitForTransientOverlayHistory(page); await page.goBack(); await leave.getByRole("button", { name: "Discard", exact: true }).click(); await expect(page).not.toHaveURL(new RegExp(`meeting=${id}`));
  expect((await scheduleFixtureDb().doc(`weeklyMeetings/${id}`).get()).get("injuries")).toHaveLength(1);
});
test("Incident write failure retains form and existing record; retry saves at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await enter(page); await draft(page);
  const ref = scheduleFixtureDb().doc(`weeklyMeetings/${id}`); const original = (await ref.get()).data()!; await ref.delete();
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click(); await expect(page.getByTestId("meeting-save-state")).toContainText("Save failed"); await expect(page.getByRole("textbox", { name: "Injury / medical concern" })).toHaveValue("Synthetic concern");
  await ref.set(original); await page.getByRole("button", { name: "Save Meeting", exact: true }).click(); await expect(page.getByTestId("meeting-save-state")).toHaveText("Saved"); expect((await ref.get()).get("injuries")).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await page.screenshot({ path: test.info().outputPath("run-320.png"), fullPage: true });
  await waitForTransientOverlayHistory(page); await page.goBack(); await expect(page).not.toHaveURL(new RegExp(`meeting=${id}`));
});
test("Read-only Run has scoped attendance and reference, with no incident writes", async ({ page }) => {
  const ref = scheduleFixtureDb().doc(`weeklyMeetings/${id}`); const before = (await ref.get()).data();
  await loginAsLeader(page, { email: "test.group.secretary@example.com", password: password! }); await page.goto(`/leader/weekly?meeting=${id}`); await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByTestId("attendance-list").getByRole("checkbox").first()).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Incident member" })).toHaveCount(0); await expect(page.getByRole("button", { name: "Save Meeting", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View programme", exact: true }).click(); await expect(page.getByRole("dialog", { name: "Programme reference" })).toContainText("Reference instructions"); expect((await ref.get()).data()).toEqual(before);
});
test("More actions blocks incomplete incidents and saves a complete incident before creating another meeting", async ({ page }) => {
  await enter(page); await page.getByRole("textbox", { name: "Action taken" }).fill("Incomplete action");
  await page.getByRole("button", { name: "More actions", exact: true }).click(); await page.getByRole("menuitem", { name: "Copy Meeting", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Select a member" })).toBeVisible(); await expect(page).toHaveURL(new RegExp(`meeting=${id}$`));
  await draft(page); await page.getByRole("button", { name: "More actions", exact: true }).click(); await page.getByRole("menuitem", { name: "Create another", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\/create$/); expect((await scheduleFixtureDb().doc(`weeklyMeetings/${id}`).get()).get("injuries")).toHaveLength(1);
});
test("Authorised closed-meeting corrections save incidents while programme remains locked", async ({ page }) => {
  const ref = scheduleFixtureDb().doc(`weeklyMeetings/${id}`); await ref.update({ status: "closed" }); await enter(page);
  await draft(page, "Closed correction"); await page.getByRole("button", { name: "Save Meeting", exact: true }).click(); await expect(page.getByTestId("meeting-save-state")).toHaveText("Saved");
  expect((await ref.get()).get("status")).toBe("closed"); expect((await ref.get()).get("injuries")[0].concern).toBe("Closed correction");
  await page.getByRole("button", { name: "Plan", exact: true }).click(); await expect(page.getByRole("textbox", { name: "Theme", exact: true })).toBeDisabled();
});
