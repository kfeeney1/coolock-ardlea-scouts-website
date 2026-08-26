import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const adminEmail = process.env.E2E_ADMIN_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Weekly Meeting audit coverage runs once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("section leader Weekly Meeting update is visible in the Activity Log", async ({ page, browser }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail || !adminEmail, "Configure canonical E2E leader/admin credentials.");

  // Use a different deterministic date on each retry so a failed attempt cannot
  // leave an open meeting that changes the next attempt's starting state.
  const day = String(testInfo.retry + 1).padStart(2, "0");
  const auditDate = `2099-05-${day}`;

  await login(page, leaderEmail!);
  await page.goto("/leader/weekly");
  await page.getByLabel("Meeting date").fill(auditDate);
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await expect(page.getByTestId("weekly-meeting-editor-top")).toBeVisible();

  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await page.getByLabel("Theme").fill("Audit coverage meeting");
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
  await expect(page.getByText("Meeting saved.")).toBeVisible();

  // Verify the audit record in a separate authenticated browser context. This
  // avoids coupling the audit assertion to the responsive Leader Menu/logout UI.
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  try {
    await login(adminPage, adminEmail!);
    await adminPage.goto("/leader/activity");
    await adminPage.getByLabel("Search activity").fill(auditDate);
    await expect(adminPage.getByText("weekly-meeting-update", { exact: true }).first()).toBeVisible();
    await expect(adminPage.getByText(`Scouts Weekly Meeting · ${auditDate}`, { exact: true }).first()).toBeVisible();
    await expect(adminPage.getByText(leaderEmail!, { exact: true }).first()).toBeVisible();
  } finally {
    await adminContext.close();
  }
});
