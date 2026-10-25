import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { calendarDateFixtures } from "./support/calendar-date-fixtures";
const uid = "TEST_uid_scout_programme_scouter", categories = ["Garda vetting", "First Aid", "Child Protection"];
const context = "/calendar?month=2040-06&type=all&section=Group";
async function fixture(seeded = false) {
  const calendar = await calendarDateFixtures(), db = calendar.db;
  const setting = db.doc("siteSettings/leaderTrainingExperience"), previous = await setting.get();
  const records = db.collection(`adminUsers/${uid}/training`), existing = await records.get();
  for (const doc of existing.docs) await doc.ref.delete();
  await setting.set({version: "redesigned"});
  if (seeded) for (const category of ["garda-vetting", "first-aid", "child-protection"]) await records.doc(category).set({completedDate: "2040-01-01", expiryDate: "2040-06-15", showOnCalendar: true, revision: 1});
  return {db, setting, records, restore: async () => {
    for (const doc of (await records.get()).docs) await doc.ref.delete();
    for (const doc of existing.docs) await doc.ref.set(doc.data());
    if (previous.exists) await setting.set(previous.data()!); else await setting.delete();
    await calendar.restore();
  }};
}
async function login(page: Page, email = "superadmin@example.com") { await loginAsLeader(page, {email, password: process.env.E2E_TEST_USER_PASSWORD!}); }
async function logout(page: Page) {
  await page.locator('button[aria-controls="leader-navigation"]').click();
  await page.getByRole("navigation", {name: "Leader navigation", exact: true}).getByRole("button", {name: "Sign Out", exact: true}).click();
  await expect(page).toHaveURL(/\/leader\/login$/);
}
async function calendar(page: Page) {
  await page.goto(context);
  await expect(page.getByRole("combobox", {name: "Calendar section", exact: true})).toBeEnabled();
  await expect(page.getByRole("button", {name: "Training", exact: true})).toBeVisible();
}
const reminders = (page: Page, date: string) => page.locator(`[data-calendar-date="${date}"]`).getByRole("link", {name: /^Training renewal:/});
async function save(page: Page) {
  await page.getByRole("button", {name: "Save record", exact: true}).focus(); await page.keyboard.press("Enter");
  await expect(page.getByText("Training record saved.", {exact: true})).toBeVisible();
}
test("all categories opt in, persist, coexist with meetings and renew a single canonical calendar entry", async ({page}) => {
  const f = await fixture();
  try {
    await login(page); await page.goto(`/leader/access/${uid}`);
    for (const category of categories) {
      await page.getByRole("article", {name: category, exact: true}).getByRole("button", {name: "Add dates", exact: true}).click();
      await page.getByRole("switch", {name: "Show renewal on group calendar", exact: true}).check();
      await page.getByRole("button", {name: "Save record", exact: true}).click();
      await expect(page.getByRole("alert").filter({hasText: "Record an expiry"}).first()).toBeVisible();
      await page.getByRole("textbox", {name: "Expiry / lapse date", exact: true}).fill("15-06-2040");
      await save(page);
    }
    await calendar(page); await expect(reminders(page, "2040-06-15")).toHaveCount(3);
    // Group filter hides Scouts meetings; removing it retains both source types.
    await page.goto("/calendar?month=2040-06&type=all");
    await expect(page.locator('[data-calendar-date="2040-06-15"]').getByRole("link")).toHaveCount(7);
    await calendar(page); await reminders(page, "2040-06-15").filter({hasText: "First Aid"}).click();
    await expect(page).toHaveURL(new RegExp(`/leader/access/${uid}#training-first-aid$`));
    await expect(page.getByRole("article", {name: "First Aid", exact: true})).toBeFocused();
    await page.getByRole("article", {name: "First Aid", exact: true}).getByRole("button", {name: "Record renewal", exact: true}).click();
    await page.getByRole("textbox", {name: "Expiry / lapse date", exact: true}).fill("16-06-2040"); await save(page);
    await page.getByRole("link", {name: "Back to calendar", exact: true}).click();
    await expect(page).toHaveURL(context); await expect(reminders(page, "2040-06-15")).toHaveCount(2); await expect(reminders(page, "2040-06-16")).toHaveCount(1);
    await page.reload(); await expect(reminders(page, "2040-06-16")).toHaveCount(1);
    expect((await f.records.get()).size).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {await f.restore();}
});
test("disabling a category retains dates; own reminders open read-only records and return to the same calendar", async ({page}) => {
  const f = await fixture(true);
  try {
    await login(page); await page.goto(`/leader/access/${uid}`);
    await page.getByRole("article", {name: "Garda vetting", exact: true}).getByRole("button", {name: "Edit record", exact: true}).click();
    await page.getByRole("switch", {name: "Show renewal on group calendar", exact: true}).uncheck(); await save(page);
    await calendar(page); await expect(reminders(page, "2040-06-15")).toHaveCount(2);
    expect((await f.records.doc("garda-vetting").get()).data()?.expiryDate).toBe("2040-06-15");
    await logout(page); await login(page, "test.scout.programme.scouter@example.com"); await calendar(page);
    await expect(reminders(page, "2040-06-15")).toHaveCount(2);
    await page.getByRole("button", {name: "Training", exact: true}).click();
    await reminders(page, "2040-06-15").first().click(); await expect(page).toHaveURL(/\/leader\/profile#training-/);
    await expect(page.getByRole("article", {name: "Child Protection", exact: true})).toBeFocused();
    await expect(page.getByRole("button", {name: /^(Add dates|Edit record|Record renewal)$/})).toHaveCount(0);
    await page.getByRole("link", {name: "Back to calendar", exact: true}).click(); await expect(page).toHaveURL(context.replace("type=all", "type=training"));
  } finally {await f.restore();}
});
test("training feature off hides reminders and retains records; parents receive no training names or categories", async ({page}) => {
  const f = await fixture(true);
  try {
    await login(page); await calendar(page); await expect(reminders(page, "2040-06-15")).toHaveCount(3);
    await f.setting.set({version: "existing"});
    await expect(page.getByRole("link", {name: /^Training renewal:/})).toHaveCount(0);
    await expect(page.getByRole("button", {name: "Training", exact: true})).toHaveCount(0);
    expect((await f.records.get()).size).toBe(3);
    await page.reload(); await expect(page.getByRole("link", {name: /^Training renewal:/})).toHaveCount(0);
    await f.setting.set({version: "redesigned"}); await expect(reminders(page, "2040-06-15")).toHaveCount(3);
    await logout(page); await page.goto("/parent"); await page.getByLabel("Email", {exact: true}).fill("test.beaver.parent1@example.com");
    await page.getByLabel("Password", {exact: true}).fill(process.env.E2E_TEST_USER_PASSWORD!);
    await page.getByRole("button", {name: "Sign In", exact: true}).click();
    await expect(page.getByRole("button", {name: "Sign Out", exact: true}).first()).toBeVisible();
    await page.goto(context); await expect(page.getByRole("combobox", {name: "Calendar section", exact: true})).toBeEnabled();
    await expect(page.getByRole("link", {name: /^Training renewal:/})).toHaveCount(0);
    await expect(page.getByRole("button", {name: "Training", exact: true})).toHaveCount(0);
  } finally {await f.restore();}
});
