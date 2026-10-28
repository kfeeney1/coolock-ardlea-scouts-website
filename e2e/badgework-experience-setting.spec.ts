import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";

const password = process.env.E2E_TEST_USER_PASSWORD;
const label = "Badgework redesign";
const otherSettings = ["leaderNavigation", "scheduleExperience", "meetingExperience", "attendanceExperience"];
test.beforeEach(async () => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await scheduleFixtureDb().doc("siteSettings/badgeworkExperience").delete();
});
test.afterEach(async () => { await scheduleFixtureDb().doc("siteSettings/badgeworkExperience").delete(); });

for (const email of ["superadmin@example.com", "modernsuperadmin@example.com"]) test(`Badgework switch defaults off, persists and rolls back independently: ${email}`, async ({ page }, testInfo) => {
  const db = scheduleFixtureDb();
  const before = await Promise.all(otherSettings.map(async key => (await db.doc(`siteSettings/${key}`).get()).data()));
  await loginAsLeader(page, { email, password: password! });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/leader/settings");
  const toggle = page.getByRole("switch", { name: label, exact: true });
  const saved = page.getByRole("status").filter({ hasText: "Badgework setting saved." });
  await expect(toggle).toBeEnabled(); await expect(toggle).not.toBeChecked();
  await toggle.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("badgework-rollout-switch.png") });
  await toggle.focus(); await page.keyboard.press("Space");
  await expect(saved).toBeVisible(); await expect(toggle).toBeChecked();
  const setting = (await db.doc("siteSettings/badgeworkExperience").get()).data()!;
  expect(setting.version).toBe("redesigned");
  expect(setting.updatedBy).toBe(email.startsWith("modern") ? "TEST_uid_modern_super_admin_01" : "TEST_uid_super_admin_01");
  expect(setting.updatedAt.toMillis()).toBeGreaterThan(0);
  await page.reload(); await expect(toggle).toBeEnabled(); await expect(toggle).toBeChecked();
  await toggle.click(); await expect(saved).toBeVisible(); await expect(toggle).not.toBeChecked();
  await page.reload(); await expect(toggle).toBeEnabled(); await expect(toggle).not.toBeChecked();
  expect((await db.doc("siteSettings/badgeworkExperience").get()).get("version")).toBe("existing");
  expect(await Promise.all(otherSettings.map(async key => (await db.doc(`siteSettings/${key}`).get()).data()))).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const email of ["test.webadmin@example.com", "test.scout.programme.scouter@example.com"]) test(`Badgework rollout control is hidden for ${email}`, async ({ page }) => {
  await loginAsLeader(page, { email, password: password! });
  await page.goto("/leader/settings");
  if (email === "test.webadmin@example.com") {
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  } else {
    await expect(page).toHaveURL(/\/leader$/);
    await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();
  }
  await expect(page.getByRole("switch", { name: label, exact: true })).toHaveCount(0);
  expect((await scheduleFixtureDb().doc("siteSettings/badgeworkExperience").get()).exists).toBe(false);
});


test("Backend revalidates a revoked Superuser; failed save stays off and can be retried", async ({ page }) => {
  const db = scheduleFixtureDb();
  const profile = db.doc("adminUsers/TEST_uid_super_admin_01");
  await loginAsLeader(page, { email: "superadmin@example.com", password: password! });
  await page.goto("/leader/settings");
  const toggle = page.getByRole("switch", { name: label, exact: true });
  await expect(toggle).toBeEnabled(); await expect(toggle).not.toBeChecked();
  try {
    await profile.update({ role: "admin" });
    await toggle.click();
    await expect(page.getByRole("alert").filter({ hasText: "Unable to save badgework settings." })).toBeVisible();
    await expect(toggle).toBeEnabled(); await expect(toggle).not.toBeChecked();
    await expect(page.getByRole("status").filter({ hasText: "Badgework setting saved." })).toHaveCount(0);
    expect((await db.doc("siteSettings/badgeworkExperience").get()).exists).toBe(false);
  } finally { await profile.update({ role: "super-admin" }); }
  await toggle.click();
  await expect(page.getByRole("status").filter({ hasText: "Badgework setting saved." })).toBeVisible();
  await expect(toggle).toBeChecked();
  expect((await db.doc("siteSettings/badgeworkExperience").get()).get("version")).toBe("redesigned");
});
