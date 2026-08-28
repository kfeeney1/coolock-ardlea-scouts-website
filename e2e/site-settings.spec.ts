import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Site settings checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("admin can open and save site inactivity settings", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/settings");

  await expect(page.getByRole("heading", { name: "Site Settings" })).toBeVisible();
  await expect(page.getByLabel("Parent account inactivity timeout")).toHaveValue("20");
  await expect(page.getByLabel("Leader desktop inactivity timeout")).toHaveValue("20");
  await expect(page.getByLabel("Leader phone inactivity timeout")).toHaveValue("90");

  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText(/Site settings saved/)).toBeVisible();
});

test("ordinary leader cannot access site settings", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page, leaderEmail!);
  await page.goto("/leader/settings");
  await expect(page).toHaveURL(/\/leader$/);

  await page.getByRole("button", { name: /Leader Menu/ }).click();
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
});
