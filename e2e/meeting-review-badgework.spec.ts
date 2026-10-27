import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { reconcileOpenWeeklyRoster } from "../src/services/weeklyTrackerLogic";
const id = "000-sw423-review";
const password = process.env.E2E_TEST_USER_PASSWORD;
const heading = "Other badges completed — meeting notes only";
async function enter(page: Page, email = process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com") {
  await loginAsLeader(page, { email, password: password! }); await page.goto(`/leader/weekly?meeting=${id}&stage=review`);
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
}
async function progressSnapshot() {
  const db = scheduleFixtureDb(); const docs = [...(await db.collectionGroup("requirements").get()).docs, ...(await db.collectionGroup("awards").get()).docs];
  return docs.map(doc => ({ path: doc.ref.path, data: doc.data() })).sort((a, b) => a.path.localeCompare(b.path));
}
test.beforeEach(async () => {
  test.skip(!password, "Configure canonical E2E credentials."); const db = scheduleFixtureDb(); await db.doc("siteSettings/meetingExperience").set({ version: "redesigned" });
  const members = (await db.collection("members").get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const entries = reconcileOpenWeeklyRoster([], members as Parameters<typeof reconcileOpenWeeklyRoster>[1], "Scouts").map((entry, index) => ({ ...entry, attendance: index === 0 ? "present" : "absent" }));
  await db.doc(`weeklyMeetings/${id}`).set({ section: "Scouts", meetingDate: "2099-07-22", status: "open", location: "Synthetic den", programmeNotes: JSON.stringify({ marker: "weekly-programme-v1", theme: "Review fixture", notes: "" }), plannedActivities: JSON.stringify({ marker: "weekly-activities-v1", items: [] }), plannedBadgework: JSON.stringify({ marker: "weekly-badgework-v1", items: [] }), entries, injuries: [], notes: "", testData: true });
});
test.afterEach(async () => {
  const db = scheduleFixtureDb(); for (const child of (await db.collection(`weeklyMeetings/${id}/leaderAttendance`).get()).docs) await child.ref.delete();
  for (const path of [`weeklyMeetings/${id}`, `parentWeeklyMeetings/${id}`, "siteSettings/meetingExperience"]) await db.doc(path).delete();
});
test("Review saves notes before canonical tracker handoff, scopes present members and returns to the same Review", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await enter(page);
  const ref = scheduleFixtureDb().doc(`weeklyMeetings/${id}`); const entries = (await ref.get()).get("entries"); const before = await progressSnapshot();
  const other = page.getByRole("textbox", { name: /^Other completed badges/ }); await expect(other).toHaveCount(1); await other.fill("Synthetic campcraft, Synthetic community badge");
  await page.getByRole("textbox", { name: "Additional meeting notes", exact: true }).fill("Review notes retained");
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.getByRole("button", { name: "Review", exact: true }).click(); await expect(other).toHaveValue("Synthetic campcraft, Synthetic community badge");
  await page.getByTestId("weekly-adventure-badgework-link").click(); await expect(page).toHaveURL(/\/leader\/badgework\?/);
  const params = new URL(page.url()).searchParams; expect(params.get("sourceType")).toBe("weeklyMeeting"); expect(params.get("sourceId")).toBe(id); expect(params.get("memberIds")).toBe(entries[0].memberId); expect(params.get("returnTo")).toBe(`/leader/weekly?meeting=${id}&stage=review`);
  expect((await ref.get()).get("entries")[0].badges).toEqual(["Synthetic campcraft", "Synthetic community badge"]); expect((await ref.get()).get("notes")).toBe("Review notes retained"); expect(await progressSnapshot()).toEqual(before);
  await expect(page.getByRole("heading", { name: "Adventure Skills Badgework", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: new RegExp(entries[0].memberName) })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: new RegExp(entries[1].memberName) })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Weekly Meeting", exact: true }).click(); await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveAttribute("aria-pressed", "true"); await expect(other).toHaveValue("Synthetic campcraft, Synthetic community badge");
  await expect(page.getByRole("textbox", { name: "Additional meeting notes", exact: true })).toHaveValue("Review notes retained");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: test.info().outputPath("review-320.png"), fullPage: true });
});
test("Failed save blocks tracker navigation and retains notes for a successful retry", async ({ page }) => {
  await enter(page); const ref = scheduleFixtureDb().doc(`weeklyMeetings/${id}`); const original = (await ref.get()).data()!; await ref.delete();
  await page.getByRole("textbox", { name: "Additional meeting notes", exact: true }).fill("Retained after failure"); await page.getByTestId("weekly-adventure-badgework-link").click();
  await expect(page.getByTestId("meeting-save-state")).toContainText("Save failed"); await expect(page).toHaveURL(new RegExp(`meeting=${id}`)); await expect(page.getByRole("textbox", { name: "Additional meeting notes", exact: true })).toHaveValue("Retained after failure");
  await ref.set(original); await page.getByTestId("weekly-adventure-badgework-link").click(); await expect(page).toHaveURL(/\/leader\/badgework\?/); expect((await ref.get()).get("notes")).toBe("Retained after failure");
});
test("Empty-present and closed Review retain canonical badgework locks while authorised notes corrections remain editable", async ({ page }) => {
  const ref = scheduleFixtureDb().doc(`weeklyMeetings/${id}`); const entries = (await ref.get()).get("entries"); await ref.update({ entries: entries.map((entry: Record<string, unknown>) => ({ ...entry, attendance: "absent" })) }); await enter(page);
  await expect(page.getByTestId("weekly-adventure-badgework-link")).toBeDisabled(); await expect(page.getByText("Mark attendees present before recording completed badgework.", { exact: true })).toBeVisible(); await expect(page.getByRole("textbox", { name: /^Other completed badges/ })).toHaveCount(0);
  await ref.update({ status: "closed", entries }); await page.reload(); await expect(page.getByTestId("weekly-adventure-badgework-link")).toBeDisabled(); await expect(page.getByRole("textbox", { name: /^Other completed badges/ })).toBeDisabled(); await expect(page.getByRole("textbox", { name: "Additional meeting notes", exact: true })).toBeEnabled();
});
test("OFF preserves the legacy badgework presentation", async ({ page }) => {
  await scheduleFixtureDb().doc("siteSettings/meetingExperience").set({ version: "existing" });
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! }); await page.goto(`/leader/weekly?meeting=${id}&stage=review`); await page.getByRole("button", { name: "Completed Badgework", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Completed Badgework", exact: true })).toBeVisible(); await expect(page.getByRole("heading", { name: heading, exact: true })).toHaveCount(0);
});
test("Read-only Review cannot edit badge notes, additional notes or enter the tracker from the meeting", async ({ page }) => {
  const ref = scheduleFixtureDb().doc(`weeklyMeetings/${id}`); const before = (await ref.get()).data(); await enter(page, "test.group.secretary@example.com");
  await expect(page.getByTestId("weekly-adventure-badgework-link")).toBeDisabled(); await expect(page.getByRole("textbox", { name: /^Other completed badges/ })).toBeDisabled(); await expect(page.getByRole("textbox", { name: "Additional meeting notes", exact: true })).toBeDisabled(); expect((await ref.get()).data()).toEqual(before);
});
