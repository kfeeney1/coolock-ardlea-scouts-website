import { waitForTransientOverlayHistory } from "./helpers/transientOverlayHistory";
import { expect, test, type Page } from "@playwright/test";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { loginAsLeader } from "./support/authentication-helpers";
const password = process.env.E2E_TEST_USER_PASSWORD;
const uid = "TEST_uid_scout_programme_scouter";
const categories = ["Garda vetting", "First Aid", "Child Protection"];
async function fixture() {
  const db = scheduleFixtureDb(), setting = db.doc("siteSettings/leaderTrainingExperience");
  const previous = await setting.get();
  const records = db.collection(`adminUsers/${uid}/training`);
  const existing = await records.get();
  for (const record of existing.docs) await record.ref.delete();
  await setting.set({ version: "redesigned" });
  return async () => {
    for (const record of (await records.get()).docs) await record.ref.delete();
    for (const record of existing.docs) await record.ref.set(record.data());
    if (previous.exists) await setting.set(previous.data()!); else await setting.delete();
  };
}
async function dates(page: Page, start: string, end: string) {
  await page.getByRole("textbox", { name: "Completion / issue date", exact: true }).fill(start);
  await page.getByRole("textbox", { name: "Expiry / lapse date", exact: true }).fill(end);
}
async function save(page: Page) {
  await page.getByRole("button", { name: "Save record", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Training record saved.", { exact: true })).toBeVisible();
  await expect(page.getByRole("form", { name: /dates$/ })).toHaveCount(0);
}
test("training categories create, validate, renew and persist on the correct leader with mobile layout and own read-only view", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const restore = await fixture();
  try {
    await page.clock.setFixedTime(new Date("2026-10-24T12:00:00Z"));
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto(`/leader/access/${uid}?q=Scouts&active=all`);
    for (const category of categories) {
      const card = page.getByRole("article", { name: category, exact: true });
      await expect(card).toContainText("Not recorded");
      await card.getByRole("button", { name: "Add dates", exact: true }).click();
      await dates(page, "25-10-2026", "24-10-2026");
      await page.getByRole("button", { name: "Save record", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "must be on or after" }).first()).toBeVisible();
      const expiry = category === "Child Protection" ? "23-10-2026" : "24-10-2026";
      await dates(page, "01-01-2026", expiry);
      await save(page);
      await expect(card).toContainText(category === "Child Protection" ? "Expired" : "Current");
      await expect(card).toContainText(expiry);
    }
    await page.reload();
    const firstAid = page.getByRole("article", { name: "First Aid", exact: true });
    await expect(firstAid).toContainText("Current");
    await firstAid.getByRole("button", { name: "Edit record", exact: true }).click();
    await dates(page, "01-01-2026", ""); await save(page);
    await expect(firstAid).toContainText("Incomplete");
    await firstAid.getByRole("button", { name: "Record renewal", exact: true }).click();
    await dates(page, "24-10-2026", "24-10-2027"); await save(page);
    await page.reload(); await expect(firstAid).toContainText("24-10-2027");
    const docs = await scheduleFixtureDb().collection(`adminUsers/${uid}/training`).get();
    expect(docs.size).toBe(3);
    expect(docs.docs.find(doc => doc.id === "first-aid")?.data().revision).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Back to leaders", exact: true }).click();
    await expect(page).toHaveURL(/\/leader\/access\?q=Scouts&active=all$/);
    await page.context().clearCookies(); await page.evaluate(() => sessionStorage.clear());
    await loginAsLeader(page, { email: process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com", password: password! });
    await page.goto("/leader/profile");
    await expect(page.getByRole("article", { name: "First Aid", exact: true })).toContainText("24-10-2027");
    await expect(page.getByRole("button", { name: /^(Add dates|Edit record|Record renewal)$/ })).toHaveCount(0);
  } finally { await restore(); }
});

test("training editor guards unsaved navigation, retains dates after save failure and hides records when disabled", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const restore = await fixture();
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto(`/leader/access/${uid}`);
    const card = page.getByRole("article", { name: "Garda vetting", exact: true });
    await card.getByRole("button", { name: "Add dates", exact: true }).click();
    await dates(page, "01-01-2026", "01-01-2027");
    await page.getByRole("link", { name: "Back to leaders", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Unsaved training changes" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Stay", exact: true }).click();
    await expect(dialog).toBeHidden();
    await waitForTransientOverlayHistory(page);
    await expect(page.getByRole("textbox", { name: "Completion / issue date", exact: true })).toHaveValue("01-01-2026");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("form", { name: /dates$/ })).toHaveCount(0);
    await waitForTransientOverlayHistory(page);
    await expect(card).toContainText("Not recorded");
    await card.getByRole("button", { name: "Add dates", exact: true }).click();
    await dates(page, "01-01-2026", "01-01-2027");
    await page.context().setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await page.getByRole("button", { name: "Save record", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Unable|connection|offline|network/i }).first()).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Expiry / lapse date", exact: true })).toHaveValue("01-01-2027");
    await expect(page.getByRole("button", { name: "Save record", exact: true })).toBeEnabled();
    expect((await scheduleFixtureDb().collection(`adminUsers/${uid}/training`).get()).size).toBe(0);
    await page.context().setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await save(page);
    expect((await scheduleFixtureDb().collection(`adminUsers/${uid}/training`).get()).size).toBe(1);
    await scheduleFixtureDb().doc("siteSettings/leaderTrainingExperience").set({ version: "existing" });
    await expect(page.getByRole("heading", { name: "Training & vetting", exact: true })).toHaveCount(0);
    await scheduleFixtureDb().doc("siteSettings/leaderTrainingExperience").set({ version: "redesigned" });
    await expect(card).toContainText("01-01-2027");
  } finally { await page.context().setOffline(false); await restore(); }
});
