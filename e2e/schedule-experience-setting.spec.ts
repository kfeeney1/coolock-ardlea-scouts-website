import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { rolloutSwitch, setRolloutSwitch } from "./support/rollout-switches";

const password = process.env.E2E_TEST_USER_PASSWORD;
test("Superuser can persist and roll back schedules independently of navigation", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
  await page.goto("/leader/settings");
  const schedules = rolloutSwitch(page, "schedules");
  const navigation = rolloutSwitch(page, "navigation");
  await expect(schedules).toBeEnabled();
  await expect(schedules).not.toBeChecked();
  await expect(navigation).toBeEnabled();
  const navigationWasEnabled = await navigation.isChecked();
  try {
    await schedules.focus();
    await page.keyboard.press("Space");
    await expect(schedules).toBeChecked();
    await page.reload();
    await expect(schedules).toBeEnabled();
    await expect(schedules).toBeChecked();
    await expect(navigation).toBeEnabled();
    await expect(navigation).toBeChecked({ checked: navigationWasEnabled });
  } finally {
    await setRolloutSwitch(page, "schedules", false);
  }
  await page.reload();
  await expect(schedules).toBeEnabled();
  await expect(schedules).not.toBeChecked();
});
