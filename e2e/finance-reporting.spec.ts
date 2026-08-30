import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Finance reporting checks run once on desktop Chromium.");
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("section leader sees permission-scoped finance reporting and export controls", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/reports");

  const panel = page.getByTestId("finance-reporting");
  await expect(panel.getByRole("heading", { name: "Finance reporting" })).toBeVisible();
  await expect(panel.getByRole("combobox", { name: "Section" })).toContainText("All permitted sections");
  await expect(panel.getByRole("combobox", { name: "Category" })).toContainText("All categories");
  await expect(panel.getByRole("button", { name: "Export Finance CSV" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Print / Save PDF" })).toBeVisible();
});
