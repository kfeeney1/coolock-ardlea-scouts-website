import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

function chromiumOnly(testInfo: TestInfo) {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Reports checks run in Chromium projects.");
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function expectReportReady(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Report ready" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Open report" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Download report" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Send report" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep working" })).toBeVisible();
  return dialog;
}

test("reports generation offers open, download, send and keep-working actions without regenerating", async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  test.skip(testInfo.project.name !== "chromium", "Full report file assertions run once on desktop Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page);
  await page.goto("/leader/reports");

  await expect(page.getByRole("heading", { name: "Reports & Exports" })).toBeVisible();
  await expect(page.getByTestId("report-summary-cards")).toBeVisible();
  const dateFilter = page.getByTestId("report-date-filter");
  const fromDate = page.getByTestId("report-from-date");
  const toDate = page.getByTestId("report-to-date");
  const resultCount = page.getByTestId("report-event-result-count");
  await expect(dateFilter).toBeVisible();
  await expect(resultCount).toHaveAttribute("role", "status");
  await expect(resultCount).toHaveAttribute("aria-live", "polite");
  await expect(resultCount).toContainText(/\d+ of \d+ events in range/);

  await fromDate.fill("2098-01-01");
  await toDate.fill("2099-12-31");
  await expect(page.getByRole("button", { name: "Reset filters" })).toBeVisible();

  await page.getByRole("button", { name: "Export Membership Summary" }).click();
  let dialog = await expectReportReady(page);

  await dialog.getByRole("button", { name: "Send report" }).click();
  const sendOptions = page.getByTestId("report-send-options");
  await expect(sendOptions.getByRole("link", { name: "Email" })).toHaveAttribute("href", /^mailto:/);
  await expect(sendOptions.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\//);

  const popupPromise = page.waitForEvent("popup");
  await dialog.getByRole("button", { name: "Open report" }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toMatch(/^blob:/);
  await popup.close();
  await expect(page).toHaveURL(/\/leader\/reports$/);

  const membershipDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("link", { name: "Download report" }).click();
  const membershipDownload = await membershipDownloadPromise;
  expect(membershipDownload.suggestedFilename()).toMatch(/^membership-summary-\d{4}-\d{2}-\d{2}\.csv$/);
  await dialog.getByRole("button", { name: "Keep working" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "Export Event Overview" }).click();
  dialog = await expectReportReady(page);
  const eventDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("link", { name: "Download report" }).click();
  expect((await eventDownloadPromise).suggestedFilename()).toMatch(/^event-overview-\d{4}-\d{2}-\d{2}\.csv$/);
  await dialog.getByRole("button", { name: "Keep working" }).click();

  await page.getByRole("button", { name: "Export Attendance Trends" }).click();
  dialog = await expectReportReady(page);
  const trendDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("link", { name: "Download report" }).click();
  expect((await trendDownloadPromise).suggestedFilename()).toMatch(/^attendance-trends-\d{4}-\d{2}-\d{2}\.csv$/);
  await dialog.getByRole("button", { name: "Keep working" }).click();

  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(fromDate).toHaveValue("");
  await expect(toDate).toHaveValue("");
});

test("Pixel 7 report result actions fit the viewport and keep application state", async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  test.skip(testInfo.project.name !== "mobile-chromium", "This regression covers the Pixel 7 project.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page);
  await page.goto("/leader/reports");

  await page.getByRole("button", { name: "Export Membership Summary" }).click();
  const dialog = await expectReportReady(page);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(412);

  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByTestId("report-send-options").getByRole("link", { name: "Email" })).toBeVisible();
  await dialog.getByRole("button", { name: "Keep working" }).click();
  await expect(page).toHaveURL(/\/leader\/reports$/);
  await expect(page.getByRole("heading", { name: "Reports & Exports" })).toBeVisible();
});
