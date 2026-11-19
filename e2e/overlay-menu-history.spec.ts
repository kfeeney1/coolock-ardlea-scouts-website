import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { holdOverlayCloseForMenu } from "./support/overlay-close-race";
import { rolloutSwitch, setRolloutSwitch } from "./support/rollout-switches";

const password = process.env.E2E_TEST_USER_PASSWORD;
for (const redesigned of [false, true]) {
  test(`${redesigned ? "Redesigned" : "Existing"} dialog cleanup preserves a newly opened Leader menu and real Sign Out`, async ({ page, browser, baseURL }, testInfo) => {
    test.skip(!password, "Configure canonical E2E credentials.");
    const context = await browser.newContext({ baseURL });
    const settings = await context.newPage();
    let original: boolean | undefined;
    try {
      await loginAsLeader(settings, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
      await settings.goto("/leader/settings");
      const navigationSwitch = rolloutSwitch(settings, "navigation");
      await expect(navigationSwitch).toBeEnabled();
      original = await navigationSwitch.isChecked();
      await setRolloutSwitch(settings, "navigation", redesigned);

      await loginAsLeader(page, { email: "test.webadmin@example.com", password: password! });
      await page.goto("/leader/members");
      await page.getByRole("button", { name: "Add Member", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Add Existing Member", exact: true });
      await expect(dialog).toBeVisible();
      await expect.poll(() => page.evaluate(() =>
        (window.history.state?.usr?.__coolockArdleaBackDismissStack || []).at(-1)?.startsWith("transient-overlay:") === true
      )).toBe(true);
      const race = await holdOverlayCloseForMenu(page);
      try {
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(dialog).toBeHidden();
        await race.ready();
        const header = page.getByTestId("leader-dashboard-header");
        const menuButton = header.locator('button[aria-controls="leader-navigation"]');
        await menuButton.click();
        await expect.poll(() => page.evaluate(() =>
          (window.history.state?.usr?.__coolockArdleaBackDismissStack || []).at(-1)?.startsWith("leader-navigation:") === true
        )).toBe(true);
        await race.flush();
        await expect(menuButton).toHaveAttribute("aria-expanded", "true");
        await expect(header.getByRole("navigation", { name: "Leader navigation", exact: true })).toBeVisible();
        await expect(header.getByTestId(redesigned ? "leader-navigation-redesigned" : testInfo.project.name === "mobile-chromium" ? "leader-navigation-mobile" : "leader-navigation-desktop")).toBeVisible();
        await header.getByRole("button", { name: "Sign Out", exact: true }).click();
        await expect(page).toHaveURL(/\/leader\/login$/);
        await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
      } finally { await race.restore(); }
    } finally {
      try {
        if (original !== undefined) {
          await setRolloutSwitch(settings, "navigation", original);
        }
      } finally { await context.close(); }
    }
  });
}
