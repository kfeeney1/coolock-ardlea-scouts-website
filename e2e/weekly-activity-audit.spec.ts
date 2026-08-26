import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const auditDate = "2099-05-01";
const auditDisplayDate = /1 May 2099 · Scouts/;

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

async function openOrCreateAuditMeeting(page: Page) {
  const open = page.getByRole("button", { name: auditDisplayDate });
  const closed = page.getByTestId(/meeting-history-/).filter({ hasText: auditDisplayDate });
  if (await open.count()) {
    await open.first().click();
  } else if (await closed.count()) {
    await closed.first().getByRole("button", { name: "View / Edit" }).click();
    if (await page.getByRole("button", { name: "Reopen Meeting" }).count()) {
      await page.getByRole("button", { name: "Reopen Meeting" }).click();
    }
  } else {
    await page.getByLabel("Meeting date").fill(auditDate);
    await page.getByRole("button", { name: "Create Meeting" }).click();
  }
}

test("section leader Weekly Meeting update is visible in the Activity Log", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail || !adminEmail, "Configure canonical E2E leader/admin credentials.");

  await login(page, leaderEmail!);
  await page.goto("/leader/weekly");
  await openOrCreateAuditMeeting(page);
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await page.getByLabel("Theme").fill("Audit coverage meeting");
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
  await expect(page.getByText("Meeting saved.")).toBeVisible();

  await page.getByRole("button", { name: /Leader Menu/ }).click();
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(/\/leader\/login$/);

  await login(page, adminEmail!);
  await page.goto("/leader/activity");
  await page.getByLabel("Search activity").fill(auditDate);
  await expect(page.getByText("weekly-meeting-update", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`Scouts Weekly Meeting · ${auditDate}`, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(leaderEmail!, { exact: true }).first()).toBeVisible();
});
