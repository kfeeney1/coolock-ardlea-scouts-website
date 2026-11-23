import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
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
  // Wait for report data and controls to hydrate before requesting the export.
  // Otherwise the initial mobile click can race the route's loading state.
  await expect(page.getByRole("heading", { name: "Reports & Exports" })).toBeVisible();
  await expect(page.getByTestId("report-summary-cards")).toBeVisible();
  const exportButton = page.getByRole("button", { name: "Export Membership Summary" });
  await expect(exportButton).toBeEnabled();
  await exportButton.click();
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

test("administrator can open aggregate attendance but cannot open named attendance or the matrix", async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page);
  for (const url of ["/leader/attendance", "/leader/attendance?view=matrix"]) {
    await page.goto(url);
    await expect(page.getByText("You do not have access to this report.")).toBeVisible();
    await expect(page.getByTestId("attendance-member-card")).toHaveCount(0);
  }
  await page.goto("/leader/attendance?view=trends");
  await expect(page.getByRole("heading", { name: "Attendance trends" })).toBeVisible();
  await expect(page.getByText("Scope: All sections")).toBeVisible();
});

test("Reports rollout preserves attendance grants in both switch states", async ({ page, browser, baseURL }, testInfo) => {
  chromiumOnly(testInfo);
  test.skip(testInfo.project.name !== "chromium", "Reports rollout assertions run once on desktop Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  const setting = scheduleFixtureDb().doc("siteSettings/reportsExperience");
  const previous = await setting.get();
  const session = await browser.newContext({ baseURL });
  try {
    await loginAsLeader(page, { email: process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com", password: password! });
    const denied = await session.newPage();
    await loginAsLeader(denied, { email: "test.multi.section.leader@example.com", password: password! });

    for (const version of ["existing", "redesigned"]) {
      await setting.set({ version });
      await denied.goto("/leader/reports/home");
      await expect(denied.getByText("You do not have access to these reports.")).toBeVisible();
      await denied.goto("/leader/attendance?view=trends");
      await expect(denied.getByText("You do not have access to this report.")).toBeVisible();

      // The existing Reports experience can redirect before the document load event.
      await page.goto("/leader/reports/home", { waitUntil: "commit" });
      if (version === "redesigned") {
        await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
        await page.getByRole("link", { name: "Attendance Insights", exact: true }).click();
      }
      await expect(page).toHaveURL(/\/leader\/attendance$/);
      await expect(page.getByText(/Scope:/)).toContainText("Scouts");
      await page.getByRole("combobox", { name: "Section" }).click();
      await expect(page.getByRole("option", { name: "Cubs", exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
  } finally {
    await session.close();
    if (previous.exists) await setting.set(previous.data()!);
    else await setting.delete();
  }
});

test("Membership Totals exposes section aggregates and CSV without group print", async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: "test.beaver.section.leader@example.com", password: password! });
  await page.goto("/leader/reports/membership");
  await expect(page.getByText("Scope: Beavers", { exact: true })).toBeVisible();
  const table = page.getByRole("table", { name: "Membership totals" });
  await expect(table.getByRole("rowheader", { name: "Beavers", exact: true })).toBeVisible();
  await expect(table.getByRole("rowheader", { name: "Scouts", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export Membership Summary" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Print / Save PDF" })).toHaveCount(0);
});

test("ordinary Scouter cannot open Membership Totals directly", async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: "test.multi.section.leader@example.com", password: password! });
  await page.goto("/leader/reports/membership");
  await expect(page.getByRole("alert").filter({ hasText: "You do not have access to this report." })).toBeVisible();
  await expect(page.getByRole("table", { name: "Membership totals" })).toHaveCount(0);
});

test("Section Leader sees scoped names and status without guardian columns or CSV", async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: "test.beaver.section.leader@example.com", password: password! });
  await page.goto("/leader/reports/member-list");
  const table = page.getByRole("table", { name: "Member list" });
  await expect(table.getByRole("rowheader", { name: "Riley Nolan Beavers 01" })).toBeVisible();
  await expect(table.getByRole("cell", { name: "Scouts", exact: true })).toHaveCount(0);
  await expect(table.getByRole("columnheader", { name: "Email" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export Member CSV" })).toHaveCount(0);
});

test("Secretary can open the group member list and use its approved CSV", async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: "test.group.secretary@example.com", password: password! });
  await page.goto("/leader/reports/member-list");
  const table = page.getByRole("table", { name: "Member list" });
  await expect(table.getByRole("columnheader", { name: "Parent / Guardian" })).toBeVisible();
  await expect(table.getByRole("cell", { name: "Scouts", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Export Member CSV" })).toBeEnabled();
});

test("Event Consent Status denies ordinary Scouters and omits legacy consent CSV", async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: "test.scout.programme.scouter@example.com", password: password! });
  await page.goto("/leader/reports/event-consent");
  await expect(page.getByRole("alert").filter({ hasText: "You do not have access to this report." })).toBeVisible();
  await page.goto("/leader/reports");
  await expect(page.getByTestId("report-summary-cards")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export Outstanding Consent" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export Event CSV" })).toHaveCount(0);
});

test("Group Leader sees group Subs balances without the Treasurer CSV action", async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: "test.group.leader@example.com", password: password! });
  await page.goto("/leader/reports/subs");
  await expect(page.getByTestId("subs-balances-report")).toBeVisible();
  await expect(page.getByText("Scope: All authorised sections")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download balance CSV" })).toHaveCount(0);
});
