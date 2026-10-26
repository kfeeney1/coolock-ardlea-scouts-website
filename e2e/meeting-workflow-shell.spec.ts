import { waitForTransientOverlayHistory } from "./helpers/transientOverlayHistory";
import { FieldValue } from "firebase-admin/firestore";
import { expect, test } from "@playwright/test";
import { reconcileOpenWeeklyRoster } from "../src/services/weeklyTrackerLogic";
import { loginAsLeader } from "./support/authentication-helpers";
import { clearScheduleMeetings, scheduleFixtureDb, scheduleMeetingIds, seedScheduleMeetings } from "./support/schedule-fixtures";
const password = process.env.E2E_TEST_USER_PASSWORD;
const label = "Plan, Run and Review meeting workflow";

test.beforeEach(async () => { test.skip(!password, "Configure canonical E2E credentials."); await seedScheduleMeetings();
  const db = scheduleFixtureDb();
  for (const id of scheduleMeetingIds) {
    const ref = db.doc(`weeklyMeetings/${id}`); const record = (await ref.get()).data()!;
    await ref.update({ theme: FieldValue.delete(), programmeNotes: JSON.stringify({ marker: "weekly-programme-v1", theme: record.theme, notes: record.programmeNotes }) });
  }
  const members = (await db.collection("members").get()).docs.map(doc => ({ id: doc.id, ...doc.data(), displayName: doc.get("displayName") || `${doc.get("firstName") || ""} ${doc.get("lastName") || ""}`.trim() }));
  for (const id of scheduleMeetingIds.slice(1)) await db.doc(`weeklyMeetings/${id}`).update({ entries: reconcileOpenWeeklyRoster([], members as Parameters<typeof reconcileOpenWeeklyRoster>[1], "Scouts") });
});
test.afterEach(async () => { await clearScheduleMeetings(); await scheduleFixtureDb().doc("siteSettings/meetingExperience").delete(); });
for (const schedules of [false, true]) for (const workflow of [false, true]) test(`Meeting workflow ${workflow}, schedules ${schedules}: persistent independent switch and direct routes`, async ({ page }, testInfo) => {
  const db = scheduleFixtureDb();
  await db.doc("siteSettings/scheduleExperience").set({ version: schedules ? "redesigned" : "existing" });
  const ref = db.doc(`weeklyMeetings/${scheduleMeetingIds[2]}`);
  const before = (await ref.get()).data();
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
  await page.goto("/leader/settings");
  const toggle = page.getByRole("switch", { name: label, exact: true });
  await expect(toggle).toBeEnabled();
  await expect(toggle).not.toBeChecked();
  if (workflow) { await toggle.click(); await expect(page.getByText("Meeting workflow setting saved.", { exact: true })).toBeVisible(); }
  await page.reload();
  await expect(toggle).toBeEnabled();
  if (workflow) await expect(toggle).toBeChecked(); else await expect(toggle).not.toBeChecked();
  await page.goto(`/leader/weekly?meeting=${scheduleMeetingIds[2]}`);
  await expect(page.getByTestId("leader-dashboard-header")).toBeVisible();
  if (workflow) {
    await expect(page.getByRole("button", { name: "Plan", exact: true })).toHaveAttribute("aria-pressed", "true");
    if (schedules) await page.screenshot({ path: testInfo.outputPath("meeting-plan-shell.png"), fullPage: true });
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Additional Notes", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Injuries / Medical Issues", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Meeting", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "More actions", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Copy Meeting", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "More actions", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "More actions", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Copy Meeting", exact: true })).toBeEnabled();
    await page.goBack();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`meeting=${scheduleMeetingIds[2]}$`));
  } else {
    await expect(page.getByRole("button", { name: "Attendance", exact: true })).toBeVisible();
    await expect(page.getByTestId("meeting-workflow-shell")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Back to Weekly Meetings", exact: true }).click();
  await expect(page.getByRole("region", { name: "Meetings schedule", exact: true })).toHaveCount(schedules ? 1 : 0);
  expect((await ref.get()).data()).toEqual(before);
});

test("Live rollout preserves an active draft, focus and all stages until the editor is left", async ({ page }) => {
  const db = scheduleFixtureDb();
  const setting = db.doc("siteSettings/meetingExperience");
  await setting.set({ version: "redesigned" });
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/leader/weekly?meeting=${scheduleMeetingIds[2]}`);
  const theme = page.getByRole("textbox", { name: "Theme", exact: true });
  await theme.fill("Unsaved workflow theme");
  await expect(page.getByTestId("meeting-save-state")).toHaveText("Unsaved changes");
  await setting.set({ version: "existing" });
  await expect(page.getByText(/This editor keeps its current layout and edits/)).toBeVisible();
  await expect(theme).toBeFocused();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByRole("textbox", { name: "Injury / medical concern", exact: true }).fill("Incident draft");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("textbox", { name: "Additional meeting notes", exact: true }).fill("Review draft");
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(theme).toHaveValue("Unsaved workflow theme");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Injury / medical concern", exact: true })).toHaveValue("Incident draft");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Complete the retained incident before saving the pinned editor.
  await page.getByRole("combobox", { name: "Incident member" }).click();
  await page.getByRole("option").first().click();
  await waitForTransientOverlayHistory(page);
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
  await expect(page.getByTestId("meeting-save-state")).toHaveText("Saved");
  await expect(page.getByTestId("meeting-workflow-shell")).toBeVisible();
  expect(JSON.parse((await db.doc(`weeklyMeetings/${scheduleMeetingIds[2]}`).get()).get("programmeNotes")).theme).toBe("Unsaved workflow theme");
  await page.reload();
  await expect(page.getByRole("button", { name: "Attendance", exact: true })).toBeVisible();
  await expect(page.getByTestId("meeting-workflow-shell")).toHaveCount(0);
});

test("Closed direct routes open Review and keep planning locks; ordinary leaders cannot change rollout", async ({ page }) => {
  await scheduleFixtureDb().doc("siteSettings/meetingExperience").set({ version: "redesigned" });
  await loginAsLeader(page, { email: "test.scout.programme.scouter@example.com", password: password! });
  await page.goto("/leader/settings");
  await expect(page.getByRole("switch", { name: label, exact: true })).toHaveCount(0);
  await page.goto(`/leader/weekly?meeting=${scheduleMeetingIds[0]}`);
  await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("weekly-adventure-badgework-link")).toBeDisabled();
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Theme", exact: true })).toBeDisabled();
});

test("OFF editor keeps its draft when rollout turns ON and applies it on the next visit", async ({ page }) => {
  const db = scheduleFixtureDb();
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
  await page.goto(`/leader/weekly?meeting=${scheduleMeetingIds[2]}`);
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  const theme = page.getByRole("textbox", { name: "Theme", exact: true });
  await theme.fill("Legacy draft survives rollout");
  await db.doc("siteSettings/meetingExperience").set({ version: "redesigned" });
  await expect(page.getByText(/This editor keeps its current layout and edits/)).toBeVisible();
  await expect(theme).toHaveValue("Legacy draft survives rollout");
  await expect(page.getByTestId("meeting-workflow-shell")).toHaveCount(0);
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
  await expect(page.getByText(/^Meeting saved\./)).toBeVisible();
  await page.getByRole("button", { name: "Back to Weekly Meetings", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly$/);
  await page.goto(`/leader/weekly?meeting=${scheduleMeetingIds[2]}`);
  await expect(page.getByTestId("meeting-workflow-shell")).toBeVisible();
  await expect(theme).toHaveValue("Legacy draft survives rollout");
});
