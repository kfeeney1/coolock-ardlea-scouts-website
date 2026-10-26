import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { waitForTransientOverlayHistory } from "./helpers/transientOverlayHistory";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { reconcileOpenWeeklyRoster } from "../src/services/weeklyTrackerLogic";
const password = process.env.E2E_TEST_USER_PASSWORD;
const id = "000-sw421-save-share";
async function enter(page: Page) {
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
  await page.goto(`/leader/weekly?meeting=${id}`);
  await expect(page.getByRole("button", { name: "Share programme", exact: true })).toBeVisible();
}
const dialog = (page: Page) => page.getByRole("dialog", { name: "Share programme", exact: true });
test.beforeEach(async () => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const db = scheduleFixtureDb();
  await db.doc("siteSettings/meetingExperience").set({ version: "redesigned" });
  const members = (await db.collection("members").get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const entries = reconcileOpenWeeklyRoster([], members as Parameters<typeof reconcileOpenWeeklyRoster>[1], "Scouts");
  await db.doc(`weeklyMeetings/${id}`).set({ section: "Scouts", meetingDate: "2099-07-22", status: "open", location: "Synthetic den", programmeNotes: JSON.stringify({ marker: "weekly-programme-v1", theme: "Original share theme", notes: "PRIVATE PROGRAMME NOTES" }), plannedActivities: JSON.stringify({ marker: "weekly-activities-v1", items: [{ id: "one", activity: "Original game", leader: "PRIVATE LEADER", equipment: "Cones", notes: "PRIVATE INSTRUCTIONS", durationMinutes: 20 }] }), plannedBadgework: JSON.stringify({ marker: "weekly-badgework-v1", items: [] }), entries, injuries: entries.length ? [{ memberId: entries[0].memberId, memberName: entries[0].memberName, concern: "PRIVATE MEDICAL", severity: "minor", actionTaken: "PRIVATE ACTION", parentInformed: false, recordedAt: "2099-07-22T12:00:00Z" }] : [], notes: "PRIVATE MEETING NOTES", testData: true });
});
test.afterEach(async ({ page }) => {
  await page.context().setOffline(false);
  const db = scheduleFixtureDb();
  const children = await db.collection(`weeklyMeetings/${id}/leaderAttendance`).get();
  for (const child of children.docs) await child.ref.delete();
  for (const path of [`weeklyMeetings/${id}`, `parentWeeklyMeetings/${id}`, "siteSettings/meetingExperience"]) await db.doc(path).delete();
});
test("Plan sharing saves programme and leader attendance first, shares only public content and never opens a popup automatically", async ({ page }) => {
  await enter(page);
  await page.getByRole("textbox", { name: "Theme", exact: true }).fill("Updated saved share theme");
  await page.getByRole("button", { name: /^Activity 1: Original game/ }).click();
  await page.getByRole("textbox", { name: "Activity 1", exact: true }).fill("Updated saved share game");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const attendance = page.getByTestId("leader-attendance-row").first();
  const leaderName = await attendance.locator("p").first().textContent();
  await attendance.getByRole("combobox", { name: "Leader attendance", exact: true }).click();
  await page.getByRole("option", { name: "Present", exact: true }).click();
  await expect(attendance.getByRole("combobox", { name: "Leader attendance", exact: true })).toContainText("Present");
  await waitForTransientOverlayHistory(page);
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  const pagesBefore = page.context().pages().length;
  await page.getByRole("button", { name: "Share programme", exact: true }).dblclick();
  await expect(dialog(page).getByRole("status")).toContainText("Latest changes saved");
  const link = dialog(page).getByRole("link", { name: "Share in WhatsApp", exact: true });
  await expect(link).toBeVisible();
  const text = new URL((await link.getAttribute("href"))!).searchParams.get("text")!;
  expect(text).toContain("Updated saved share theme"); expect(text).toContain("Updated saved share game");
  expect(text).not.toMatch(/PRIVATE/); expect(text).not.toContain(leaderName!);
  expect(page.context().pages().length).toBe(pagesBefore);
  const db = scheduleFixtureDb(); const stored = (await db.doc(`weeklyMeetings/${id}`).get()).data()!;
  expect(JSON.parse(stored.programmeNotes).theme).toBe("Updated saved share theme");
  const leaders = await db.collection(`weeklyMeetings/${id}/leaderAttendance`).get();
  expect(leaders.docs.some(doc => doc.get("attendance") === "present")).toBe(true);
});
test("A stale-record save failure blocks sharing, retains edits and supports retry after recovery", async ({ page }) => {
  await enter(page);
  await page.getByRole("textbox", { name: "Theme", exact: true }).fill("Retained after failed share");
  const ref = scheduleFixtureDb().doc(`weeklyMeetings/${id}`); const original = (await ref.get()).data()!;
  await ref.delete();
  await page.getByRole("button", { name: "Share programme", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toContainText("Sharing is blocked");
  await expect(dialog(page).getByRole("link", { name: "Share in WhatsApp", exact: true })).toHaveCount(0);
  await ref.set(original);
  await dialog(page).getByRole("button", { name: "Retry share", exact: true }).click();
  await expect(dialog(page).getByRole("status")).toContainText("Latest changes saved");
  expect(new URL((await dialog(page).getByRole("link", { name: "Share in WhatsApp", exact: true }).getAttribute("href"))!).searchParams.get("text")).toContain("Retained after failed share");
  await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Theme", exact: true })).toHaveValue("Retained after failed share");
});
test("Offline preparation exposes no link and More actions retains save-before-share in Run and Review", async ({ page }) => {
  await enter(page);
  await page.getByRole("textbox", { name: "Theme", exact: true }).fill("Offline retained share");
  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByRole("button", { name: "Share programme", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toContainText("You are offline");
  await expect(dialog(page).getByRole("link")).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
  await page.context().setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  for (const stage of ["Run", "Review"]) {
    await waitForTransientOverlayHistory(page);
    await page.getByRole("button", { name: stage, exact: true }).click();
    await page.getByRole("button", { name: "More actions", exact: true }).click();
    const share = page.getByRole("menuitem", { name: "Share in WhatsApp", exact: true });
    await expect(share).toBeEnabled(); await share.click();
    await expect(dialog(page).getByRole("status")).toContainText("Latest changes saved");
    await expect(page).toHaveURL(new RegExp(`meeting=${id}$`));
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
  }
});
test("Read-only leaders can share the permitted saved programme without writing meeting data", async ({ page }) => {
  const ref = scheduleFixtureDb().doc(`weeklyMeetings/${id}`); const before = (await ref.get()).data();
  await loginAsLeader(page, { email: "test.group.secretary@example.com", password: password! });
  await page.goto(`/leader/weekly?meeting=${id}`);
  await expect(page.getByRole("button", { name: "Save Meeting", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Share in WhatsApp", exact: true }).click();
  await expect(dialog(page).getByRole("status")).toContainText("Latest changes saved");
  const text = new URL((await dialog(page).getByRole("link", { name: "Share in WhatsApp", exact: true }).getAttribute("href"))!).searchParams.get("text")!;
  expect(text).toContain("Original share theme"); expect(text).not.toMatch(/PRIVATE/);
  expect((await ref.get()).data()).toEqual(before);
});
