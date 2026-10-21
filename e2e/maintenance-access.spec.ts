import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
const password = process.env.E2E_TEST_USER_PASSWORD;
for (const navigationVersion of ["existing", "redesigned"] as const) test(`Maintenance rollout, visible navigation, refresh and Back (${navigationVersion})`, async ({ page }, testInfo) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const setting = scheduleFixtureDb().doc("siteSettings/maintenanceExperience");
  const before = await setting.get();
  const navigationSetting = scheduleFixtureDb().doc("siteSettings/leaderNavigation");
  const previousNavigation = await navigationSetting.get();
  try {
    await navigationSetting.set({version: navigationVersion});
    await setting.delete();
    await page.goto("/maintenance/tasks");
    await expect(page.getByText("Sign in to access Maintenance.", { exact: true })).toBeVisible();
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/maintenance/tasks");
    await expect(page.getByText("Maintenance is currently disabled.", { exact: true })).toBeVisible();
    // A legacy enabled value must remain disabled until a deliberate SDK rollout.
    await setting.set({version: "redesigned"});
    await page.reload();
    await expect(page.getByText("Maintenance is currently disabled.", { exact: true })).toBeVisible();
    await page.goto("/leader/settings");
    const enable = page.getByRole("button", { name: "Maintenance enabled", exact: true });
    await expect(page.getByRole("button", { name: "Maintenance disabled", exact: true })).toHaveAttribute("aria-pressed", "true");
    await enable.click();
    await expect(enable).toHaveAttribute("aria-pressed", "true");
    expect((await setting.get()).data()?.sdkRevision).toBe(1);
    await page.reload();
    await expect(enable).toHaveAttribute("aria-pressed", "true");
    await page.locator('button[aria-controls="leader-navigation"]').click();
    const navigation = page.getByRole("navigation", {name: "Leader navigation", exact: true});
    await expect(navigation).toBeVisible();
    const group = navigation.getByRole("button", {name: /^Group Operations/}).filter({visible: true}).first();
    if (testInfo.project.name === "mobile-chromium" || navigationVersion === "redesigned") {
      await expect(group).toBeVisible();
      if (await group.getAttribute("aria-expanded") !== "true") await group.click();
    }
    await page.getByRole("link", { name: "Maintenance", exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Maintenance", exact: true }).getByRole("link", { name: "Documents", exact: true }).click();
    await expect(page).toHaveURL(/\/maintenance\/documents$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/maintenance\/tasks$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Back to Dashboard", exact: true }).click();
    await page.goto("/leader/settings");
    await page.getByRole("button", { name: "Maintenance disabled", exact: true }).click();
    await page.goto("/maintenance/documents");
    await expect(page.getByText("Maintenance is currently disabled.", { exact: true })).toBeVisible();
  } finally {
    if (before.exists) await setting.set(before.data()!); else await setting.delete();
    if (previousNavigation.exists) await navigationSetting.set(previousNavigation.data()!); else await navigationSetting.delete();
  }
});
