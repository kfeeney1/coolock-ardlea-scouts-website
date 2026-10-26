import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { groupLocalDate } from "../src/services/groupLocalDate";
import { waitForTransientOverlayHistory } from "./helpers/transientOverlayHistory";
const password = process.env.E2E_TEST_USER_PASSWORD;
const prefix = "SW419 creation ";
async function created() {
  return (await scheduleFixtureDb().collection("weeklyMeetings").get()).docs.filter(doc => String(doc.get("programmeNotes")).includes(prefix));
}
async function open(page: Page) {
  await loginAsLeader(page, { email: "test.scout.section.leader@example.com", password: password! });
  await page.goto("/leader/weekly");
  await page.getByRole("link", { name: "Create Meeting", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create & plan", exact: true })).toBeVisible();
}
test.beforeEach(async () => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await scheduleFixtureDb().doc("siteSettings/meetingExperience").set({ version: "redesigned" });
});
test.afterEach(async ({ page }) => {
  await page.context().setOffline(false);
  for (const doc of await created()) {
    await doc.ref.delete(); await scheduleFixtureDb().doc(`parentWeeklyMeetings/${doc.id}`).delete();
  }
  await scheduleFixtureDb().doc("siteSettings/meetingExperience").delete();
});
test("Cancel without a draft creates nothing; dirty Cancel offers Stay and Discard without saving", async ({ page }) => {
  await open(page);
  const before = (await created()).length;
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly$/);
  expect((await created()).length).toBe(before);
  await page.goto("/leader/weekly/create");
  const title = page.getByRole("textbox", { name: "Theme / programme title", exact: true });
  await title.fill(prefix + "discard");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Unsaved meeting changes", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(title).toHaveValue(prefix + "discard");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await dialog.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly$/);
  expect((await created()).length).toBe(before);
});
test("Clear is deliberate and browser Back protects a draft with Save, Discard and Stay", async ({ page }) => {
  await open(page);
  const title = page.getByRole("textbox", { name: "Theme / programme title", exact: true });
  await title.fill(prefix + "clear");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  const clear = page.getByRole("dialog", { name: "Clear meeting draft?", exact: true });
  await clear.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(title).toHaveValue(prefix + "clear");
  await waitForTransientOverlayHistory(page);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await clear.getByRole("button", { name: "Clear draft", exact: true }).click();
  await expect(title).toHaveValue("");
  await waitForTransientOverlayHistory(page);
  await title.fill(prefix + "back save");
  await page.goBack();
  const dialog = page.getByRole("dialog", { name: "Unsaved meeting changes", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(title).toHaveValue(prefix + "back save");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly$/);
  expect((await created()).length).toBe(1);
});
test("Create & plan writes once, opens today's saved record in Plan and permits another same-date meeting", async ({ page }, testInfo) => {
  await open(page);
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 800 });
  const title = page.getByRole("textbox", { name: "Theme / programme title", exact: true });
  for (const suffix of ["first", "second"]) {
    if (suffix === "second") await page.goto("/leader/weekly/create");
    await title.fill(prefix + suffix);
    await page.getByRole("textbox", { name: /^Meeting date/ }).fill(groupLocalDate());
    await page.getByRole("textbox", { name: "Location", exact: true }).fill("Synthetic meeting den");
    await page.getByRole("button", { name: "Create & plan", exact: true }).dblclick();
    await expect(page).toHaveURL(/\/leader\/weekly\?meeting=.+&stage=plan$/);
    await expect(page.getByRole("button", { name: "Plan", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("textbox", { name: "Theme", exact: true })).toHaveValue(prefix + suffix);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Location", exact: true })).toHaveValue("Synthetic meeting den");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const records = await created(); expect(records.length).toBe(2);
  expect(new Set(records.map(doc => doc.id)).size).toBe(2);
  expect(records.every(doc => doc.get("meetingDate") === groupLocalDate())).toBe(true);
});
test("Save failure retains the draft; reconnect retries without duplicate records and rollout cannot replace a draft", async ({ page }) => {
  await open(page);
  const title = page.getByRole("textbox", { name: "Theme / programme title", exact: true });
  await title.fill(prefix + "recover");
  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByRole("button", { name: "Create & plan", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /offline.*draft/i })).toBeVisible();
  await expect(title).toHaveValue(prefix + "recover");
  expect((await created()).length).toBe(0);
  await page.context().setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await scheduleFixtureDb().doc("siteSettings/meetingExperience").set({ version: "existing" });
  await expect(page.getByText(/This draft keeps its current layout/)).toBeVisible();
  await expect(title).toHaveValue(prefix + "recover");
  await page.getByRole("button", { name: "Create & plan", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);
  expect((await created()).length).toBe(1);
});
test("Read-only leaders cannot create via the direct route", async ({ page }) => {
  await loginAsLeader(page, { email: "test.group.secretary@example.com", password: password! });
  await page.goto("/leader/weekly/create");
  await expect(page.getByRole("alert").filter({ hasText: "You do not have permission to create meetings." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create & plan", exact: true })).toHaveCount(0);
});

test("Empty section roster blocks creation and retains the entered details", async ({ page }) => {
  const db = scheduleFixtureDb();
  const members = (await db.collection("members").get()).docs.filter(doc => doc.get("section") === "Scouts" || (doc.get("sections") || []).includes("Scouts"));
  const roster = (await db.collection("weeklyRosterMembers").where("section", "==", "Scouts").get()).docs;
  const previous = [...members, ...roster].map(doc => ({ ref: doc.ref, status: doc.get("status") }));
  try {
    for (const member of previous) await member.ref.update({ status: "left" });
    await open(page);
    const title = page.getByRole("textbox", { name: "Theme / programme title", exact: true });
    await title.fill(prefix + "empty roster");
    await page.getByRole("button", { name: "Create & plan", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No active members are available for that section." })).toBeVisible();
    await expect(title).toHaveValue(prefix + "empty roster");
    expect((await created()).length).toBe(0);
  } finally { for (const member of previous) await member.ref.update({ status: member.status }); }
});
