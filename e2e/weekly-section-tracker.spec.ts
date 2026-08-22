import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Weekly tracker role checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("weekly tracker rejects unauthenticated users", async ({ page }) => {
  await page.goto("/leader/weekly");
  await expect(page).toHaveURL(/\/leader\/login$/);
});

test("section leader can open weekly tracker for an assigned section", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.leader.only@example.com");
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Weekly Section Tracker" })).toBeVisible();
  await expect(page.getByLabel("Section")).toBeVisible();
  await expect(page.getByLabel("Meeting date")).toBeVisible();
  await expect(page.getByRole("button", { name: /Save Weekly Record|Update Weekly Record/ })).toBeVisible();
});

test("administrator can choose from all standard sections", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.admin@example.com");
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Weekly Section Tracker" })).toBeVisible();
  await page.getByLabel("Section").click();
  await expect(page.getByRole("option", { name: "Beavers" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Cubs" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Scouts" })).toBeVisible();
});
