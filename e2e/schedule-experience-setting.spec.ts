import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
test("Superuser can persist and roll back schedules independently of navigation", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
  await page.goto("/leader/settings");
  const existing = page.getByRole("button", { name: "Existing schedules", exact: true });
  const redesigned = page.getByRole("button", { name: "Redesigned schedules", exact: true });
  await expect(existing).toHaveAttribute("aria-pressed", "true");
  const navigation = await page.getByRole("button", { name: "Redesigned navigation", exact: true }).getAttribute("aria-pressed");
  try {
    await redesigned.click();
    await expect(redesigned).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(redesigned).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Redesigned navigation", exact: true })).toHaveAttribute("aria-pressed", navigation!);
  } finally {
    await existing.click();
    await expect(existing).toHaveAttribute("aria-pressed", "true");
  }
  await page.reload();
  await expect(existing).toHaveAttribute("aria-pressed", "true");
});
