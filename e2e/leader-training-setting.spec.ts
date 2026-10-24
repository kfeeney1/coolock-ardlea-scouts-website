import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
test("Superuser toggles leader training with keyboard and persists independently after reload", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
  await page.goto("/leader/settings");
  const toggle = page.getByRole("switch", { name: "Leader training & vetting", exact: true });
  await expect(toggle).toBeEnabled();
  const original = await toggle.isChecked();
  const calendar = page.getByRole("button", { name: "Calendar enabled", exact: true });
  const calendarState = await calendar.getAttribute("aria-pressed");
  try {
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked({ checked: !original });
    await expect(page.getByRole("status").filter({ hasText: "Leader training setting saved." })).toBeVisible();
    await page.reload();
    await expect(toggle).toBeChecked({ checked: !original });
    await expect(calendar).toHaveAttribute("aria-pressed", calendarState!);
  } finally {
    await expect(toggle).toBeEnabled();
    await toggle.setChecked(original);
    await expect(toggle).toBeChecked({ checked: original });
  }
  await page.reload();
  await expect(toggle).toBeChecked({ checked: original });
});
