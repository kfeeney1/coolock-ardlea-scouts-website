import { expect, test, type TestInfo } from "@playwright/test";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Authenticated role checks run once on desktop Chromium.");
}

test("attendance insights rejects unauthenticated users", async ({ page }) => {
  await page.goto("/leader/attendance");
  await expect(page).toHaveURL(/\/leader\/login$/);
  await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();
});

test("ordinary leader can open section-scoped attendance insights", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const email = process.env.E2E_LEADER_EMAIL?.trim();
  const password = process.env.E2E_LEADER_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!email || !password, "Configure the seeded E2E leader account to run this check.");

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: /Leader Menu/ }).click();
  await page.getByRole("link", { name: "Attendance Insights" }).click();
  await expect(page).toHaveURL(/\/leader\/attendance$/);
  await expect(page.getByRole("heading", { name: "Attendance History & Insights" })).toBeVisible();
  await expect(page.getByText(/Scope:/)).toContainText("Scouts");
});
