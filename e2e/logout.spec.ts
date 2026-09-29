import { expect, test } from "@playwright/test";

test("leader can sign out from the shared dashboard menu", async ({ page }) => {
  const email = process.env.E2E_LEADER_EMAIL?.trim();
  const password = process.env.E2E_LEADER_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
  if (!email || !password) throw new Error("Configure the seeded E2E leader credentials.");

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  const menuButton = page.getByRole("button", { name: /Open Leader Menu|Menu ·/ });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
  await page.getByRole("button", { name: "Sign Out" }).click();

  await expect(page).toHaveURL(/\/leader\/login$/);
  await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();
  await expect(page.getByTestId("leader-dashboard-header")).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/login$/);

  await page.goto("/leader");
  await expect(page).toHaveURL(/\/leader\/login$/);
});
