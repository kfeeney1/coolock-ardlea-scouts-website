import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Reports export checks run once on desktop Chromium.");
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("reports v2 filters event reports and downloads summary CSVs", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page);
  await page.goto("/leader/reports");

  await expect(page.getByRole("heading", { name: "Reports & Exports" })).toBeVisible();
  await expect(page.getByTestId("report-summary-cards")).toBeVisible();
  await expect(page.getByTestId("report-date-filter")).toBeVisible();
  await expect(page.getByTestId("attendance-trends-report")).toBeVisible();
  await expect(page.getByTestId("printable-report-summary")).toContainText("Printable operational summary");

  await page.getByLabel("From date").fill("2098-01-01");
  await page.getByLabel("To date").fill("2099-12-31");
  await expect(page.getByTestId("report-date-filter")).toContainText(/events in range/);

  const membershipDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Membership Summary" }).click();
  const membershipDownload = await membershipDownloadPromise;
  expect(membershipDownload.suggestedFilename()).toMatch(/^membership-summary-\d{4}-\d{2}-\d{2}\.csv$/);

  const eventDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Event Overview" }).click();
  const eventDownload = await eventDownloadPromise;
  expect(eventDownload.suggestedFilename()).toMatch(/^event-overview-\d{4}-\d{2}-\d{2}\.csv$/);

  const trendDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Attendance Trends" }).click();
  const trendDownload = await trendDownloadPromise;
  expect(trendDownload.suggestedFilename()).toMatch(/^attendance-trends-\d{4}-\d{2}-\d{2}\.csv$/);
});
