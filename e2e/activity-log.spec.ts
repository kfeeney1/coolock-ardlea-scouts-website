import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Activity Log role checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function openLeaderMenu(page: Page) {
  const button = page.getByRole("button", { name: /Leader Menu/ });
  await expect(button).toBeVisible();
  await button.click();
}

for (const [role, email] of [
  ["Admin", "test.webadmin@example.com"],
  ["Super Admin", "test.superadmin@example.com"]
] as const) {
  test(`${role} can open the read-only Activity Log`, async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

    await login(page, email);
    await openLeaderMenu(page);
    const link = page.getByRole("link", { name: "Activity Log" });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/leader\/activity$/);
    await expect(page.getByRole("heading", { name: "Activity Log" })).toBeVisible();
    await expect(page.getByText(/Read-only history of important administrative and leader actions/i)).toBeVisible();
  });
}

test("section Leader cannot see Activity Log navigation", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.leader.only@example.com");
  await openLeaderMenu(page);
  await expect(page.getByRole("link", { name: "Activity Log" })).toHaveCount(0);
});
