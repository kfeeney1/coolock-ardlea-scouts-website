import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Meeting role checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("meeting records rejects unauthenticated users", async ({ page }) => {
  await page.goto("/leader/meetings");
  await expect(page).toHaveURL(/\/leader\/login$/);
});

test("section leader can open section meeting records", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.leader.only@example.com");
  await page.goto("/leader/meetings");
  await expect(page.getByRole("heading", { name: "Meeting Records" })).toBeVisible();
  await expect(page.getByLabel("Section")).toBeVisible();
  await page.getByLabel("Meeting type").click();
  await expect(page.getByRole("option", { name: "Leader / Section Meeting" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Group Council Meeting" })).toHaveCount(0);
});

test("administrator can record a Group Council meeting", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.admin@example.com");
  await page.goto("/leader/meetings");
  await expect(page.getByRole("heading", { name: "Meeting Records" })).toBeVisible();
  await page.getByLabel("Meeting type").click();
  await expect(page.getByRole("option", { name: "Group Council Meeting" })).toBeVisible();
});
