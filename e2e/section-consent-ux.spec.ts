import { expect, test } from "@playwright/test";

test("the former public consent page redirects into the authenticated Parent Portal", async ({ page }) => {
  await page.goto("/activities/consent");

  await expect(page).toHaveURL(/\/parent#parent-medical-consent$/);
  await expect(page.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open .* consent form/i })).toHaveCount(0);
});
