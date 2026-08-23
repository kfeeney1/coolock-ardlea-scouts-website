import { expect, test } from "@playwright/test";

test("leader can sign out from the shared dashboard header", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Authenticated logout check runs once on desktop Chromium.");

  const email = process.env.E2E_LEADER_EMAIL?.trim();
  const password = process.env.E2E_LEADER_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!email || !password, "Configure the seeded E2E leader credentials.");

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
  await page.getByRole("button", { name: "Sign Out" }).click();

  await expect(page).toHaveURL(/\/leader\/login$/);
  await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();

  await page.goto("/leader");
  await expect(page).toHaveURL(/\/leader\/login$/);
});
