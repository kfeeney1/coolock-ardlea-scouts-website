import { expect, test } from "@playwright/test";
import { expectAttendancePresentation } from "./support/attendance-presentation";
import { loginAsLeader } from "./support/authentication-helpers";
import { seedAttendanceMatrix, matrixMeetingIds } from "./support/attendance-matrix-fixtures";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
const password = process.env.E2E_TEST_USER_PASSWORD;
import { rolloutSwitch } from "./support/rollout-switches";

test("Superuser rollout persists independently; matrix scroll, filters and rollback preserve summaries and records", async ({ page, isMobile }, testInfo) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const cleanup = await seedAttendanceMatrix();
  const db = scheduleFixtureDb();
  const before = await Promise.all(matrixMeetingIds.map(async id => (await db.doc(`weeklyMeetings/${id}`).get()).data()));
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/leader/settings");
    const matrixSetting = page.getByRole("switch", { name: "Attendance matrix", exact: true });
    await expect(matrixSetting).toBeEnabled();
    await expect(matrixSetting).not.toBeChecked();
    if (isMobile) await page.getByText("Attendance matrix", { exact: true }).tap();
    else await matrixSetting.press("Space");
    await expect(matrixSetting).toBeChecked();
    await page.reload();
    await expect(matrixSetting).toBeChecked();
    for (const kind of ["navigation", "schedules"] as const) {
      const control = rolloutSwitch(page, kind);
      await expect(control).toBeEnabled();
      await expect(control).not.toBeChecked();
    }
    await page.goto("/leader/attendance");
    await page.getByLabel("Search members").fill("SW260");
    await page.getByTestId("attendance-from-date").fill("01-01-2098");
    await page.getByTestId("attendance-to-date").fill("31-01-2098");
    const table = page.getByRole("table", { name: "Member attendance by meeting" });
    const scroll = page.getByRole("region", { name: "Scrollable attendance matrix" });
    await expect(table.getByRole("row")).toHaveCount(32);
    await expect(table.getByRole("columnheader")).toHaveCount(26);
    await expectAttendancePresentation(page, true);
    // Match no fixture member; shared seeds may contain meetings in any date range.
    await page.getByLabel("Search members").fill("SW260 NO_MATCHING_MEMBER");
    await expect(page.getByRole("alert").filter({ hasText: "No members or closed meetings match the current filters." })).toBeVisible();
    await expectAttendancePresentation(page, true);
    await page.getByLabel("Search members").fill("SW260");
    await expect(table.getByRole("row")).toHaveCount(32);
    await expect(table.getByRole("columnheader")).toHaveCount(26);
    await expect(table.getByRole("button")).toHaveCount(0);
    await expect(table.getByRole("checkbox")).toHaveCount(0);
    for (const state of ["✓ Present", "× Absent", "? Unrecorded", "— Not applicable"]) await expect(table.getByRole("cell", { name: state, exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("leader-dashboard-header")).toBeVisible();
    await expect(page.getByTestId("meeting-average-rate")).toBeVisible();
    await expect(page.getByTestId("attendance-member-card")).toHaveCount(31);
    await scroll.scrollIntoViewIfNeeded();
    await expect.poll(() => scroll.evaluate(node => node.scrollWidth > node.clientWidth && node.scrollHeight > node.clientHeight)).toBe(true);
    const member = table.getByRole("rowheader").first();
    const firstHeader = table.getByRole("columnheader").nth(1);
    const memberLeft = await member.evaluate(node => node.getBoundingClientRect().left);
    const headerTop = await firstHeader.evaluate(node => node.getBoundingClientRect().top);
    await scroll.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    expect(Math.abs((await member.evaluate(node => node.getBoundingClientRect().left)) - memberLeft)).toBeLessThan(2);
    expect(Math.abs((await firstHeader.evaluate(node => node.getBoundingClientRect().top)) - headerTop)).toBeLessThan(2);
    await page.keyboard.press("End");
    await expect.poll(() => scroll.evaluate(node => node.scrollLeft + node.clientWidth >= node.scrollWidth - 2)).toBe(true);
    await page.keyboard.press("Home");
    await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const contextBounds = await member.boundingBox();
    const cellBounds = await table.getByRole("row").nth(1).getByRole("cell").first().boundingBox();
    const viewportBounds = await scroll.boundingBox();
    expect(contextBounds).not.toBeNull(); expect(cellBounds).not.toBeNull(); expect(viewportBounds).not.toBeNull();
    expect(cellBounds!.x).toBeGreaterThanOrEqual(contextBounds!.x + contextBounds!.width - 1);
    expect(cellBounds!.x + cellBounds!.width).toBeLessThanOrEqual(viewportBounds!.x + viewportBounds!.width + 1);
    await scroll.evaluate(node => { node.scrollTop = 0; });
    // Capture document coordinates from the top so the sticky site banner does not cover the panel.
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    const panel = await scroll.locator("..").boundingBox();
    expect(panel).not.toBeNull();
    const screenshot = await page.screenshot({ fullPage: true, clip: panel!, path: testInfo.outputPath(`attendance-matrix-${testInfo.project.name}.png`) });
    await testInfo.attach("Attendance matrix", { body: screenshot, contentType: "image/png" });
    await page.getByRole("combobox", { name: "Section", exact: true }).click();
    await page.getByRole("option", { name: "Scouts", exact: true }).click();
    await expect(table.getByRole("rowheader")).toHaveCount(30);
    await expect(table.getByRole("columnheader")).toHaveCount(25);
    await expect(table.getByRole("cell", { name: "— Not applicable", exact: true })).toHaveCount(0);
    await page.getByTestId("attendance-to-date").fill("01-01-2098");
    await expect(table.getByRole("columnheader")).toHaveCount(2);
    const values = await table.innerText();
    await page.reload();
    await page.getByLabel("Search members").fill("SW260");
    await page.getByRole("combobox", { name: "Section", exact: true }).click();
    await page.getByRole("option", { name: "Scouts", exact: true }).click();
    await page.getByTestId("attendance-from-date").fill("01-01-2098");
    await page.getByTestId("attendance-to-date").fill("01-01-2098");
    await expect(table).toHaveText(values.replace(/\s+/g, " "), { useInnerText: true });
    await page.goto("/leader/settings");
    await matrixSetting.click();
    await expect(matrixSetting).toBeEnabled();
    await expect(matrixSetting).not.toBeChecked();
    await page.reload();
    await expect(matrixSetting).toBeEnabled();
    await expect(matrixSetting).not.toBeChecked();
    await page.goto("/leader/attendance");
    await expect(scroll).toHaveCount(0);
    await expectAttendancePresentation(page, false);
    await expect(page.getByTestId("meeting-average-rate")).toBeVisible();
    await expect(page.getByTestId("attendance-member-card").first()).toBeVisible();
    expect(await Promise.all(matrixMeetingIds.map(async id => (await db.doc(`weeklyMeetings/${id}`).get()).data()))).toEqual(before);
  } finally { await cleanup(); }
});

test("Attendance matrix keeps its saved state while a save is pending and after rejection", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const cleanup = await seedAttendanceMatrix();
  const commitUrl = "**/documents:commit?*";
  let rejectCommit!: () => void;
  const pendingCommit = new Promise<void>(resolve => { rejectCommit = resolve; });
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/leader/settings");
    const settingsOrigin = new URL(page.url()).origin;
    const matrixSetting = page.getByRole("switch", { name: "Attendance matrix", exact: true });
    await expect(matrixSetting).toBeEnabled();
    await expect(matrixSetting).not.toBeChecked();
    await page.route(commitUrl, async route => {
      if (route.request().method() !== "POST") return route.continue();
      await pendingCommit;
      await route.fulfill({
        status: 403,
        // Firestore can send this cross-origin request with credentials.
        headers: {
          "Access-Control-Allow-Origin": settingsOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
        json: { error: { code: 403, message: "Fixture denied the save.", status: "PERMISSION_DENIED" } },
      });
    });
    await matrixSetting.click();
    await expect(page.getByRole("status").filter({ hasText: "Saving Attendance Insights setting" })).toBeVisible();
    await expect(matrixSetting).toBeDisabled();
    await expect(matrixSetting).not.toBeChecked();
    rejectCommit();
    const rejectionAlert = page.getByRole("alert").filter({ hasText: /Unable to save Attendance Insights settings/ });
    await expect(rejectionAlert).toBeVisible();
    await expect(rejectionAlert).toContainText("Code: PERMISSION_DENIED");
    await expect(matrixSetting).toBeEnabled();
    await expect(matrixSetting).not.toBeChecked();
    await page.unroute(commitUrl);
    await matrixSetting.click();
    await expect(matrixSetting).toBeChecked();
  } finally {
    rejectCommit();
    await page.unroute(commitUrl);
    await cleanup();
  }
});

test("unset and invalid attendance settings retain existing insights; navigation and schedules do not enable the matrix", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const cleanup = await seedAttendanceMatrix();
  const db = scheduleFixtureDb();
  try {
    await loginAsLeader(page, { email: process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com", password: password! });
    for (const kind of ["leaderNavigation", "scheduleExperience"]) await db.doc(`siteSettings/${kind}`).set({ version: "redesigned" });
    for (const invalid of [undefined, "unknown"]) {
      if (invalid) await db.doc("siteSettings/attendanceExperience").set({ version: invalid });
      await page.goto("/leader/attendance");
      await expect(page.getByTestId("meeting-average-rate")).toBeVisible();
      await expect(page.getByRole("table", { name: "Member attendance by meeting" })).toHaveCount(0);
    }
    await db.doc("siteSettings/attendanceExperience").set({ version: "redesigned" });
    await page.reload();
    const table = page.getByRole("table", { name: "Member attendance by meeting" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader").filter({ hasText: "Cubs" })).toHaveCount(0);
    await page.goto("/leader/settings");
    await expect(page.getByRole("switch", { name: "Attendance matrix", exact: true })).toHaveCount(0);
  } finally { await cleanup(); }
});

test("attendance rollout reaches a separate leader session independently of mixed navigation and schedule choices", async ({ page, browser, baseURL }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const cleanup = await seedAttendanceMatrix();
  const db = scheduleFixtureDb();
  const otherSession = await browser.newContext({ baseURL });
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/leader/settings");
    const matrixSetting = page.getByRole("switch", { name: "Attendance matrix", exact: true });
    await matrixSetting.click();
    await expect(matrixSetting).toBeChecked();
    const leaderPage = await otherSession.newPage();
    await loginAsLeader(leaderPage, { email: process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com", password: password! });
    for (const navigation of [true, false]) {
      await db.doc("siteSettings/leaderNavigation").set({ version: navigation ? "redesigned" : "existing" });
      await db.doc("siteSettings/scheduleExperience").set({ version: navigation ? "existing" : "redesigned" });
      await leaderPage.goto("/leader/attendance");
      await expect(leaderPage.getByRole("table", { name: "Member attendance by meeting" })).toBeVisible();
    }
    await matrixSetting.click();
    await expect(matrixSetting).not.toBeChecked();
    await expect(leaderPage.getByRole("table", { name: "Member attendance by meeting" })).toHaveCount(0);
    await expect(leaderPage.getByTestId("meeting-average-rate")).toBeVisible();
  } finally { await otherSession.close(); await cleanup(); }
});

test("Weekly Meetings opens a matrix-only view before Meeting History and keeps both existing experiences available when disabled", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const cleanup = await seedAttendanceMatrix();
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/leader/settings");
    const matrixSetting = page.getByRole("switch", { name: "Attendance matrix", exact: true });
    await expect(matrixSetting).toBeEnabled();
    await expect(matrixSetting).not.toBeChecked();
    await matrixSetting.click();
    await expect(matrixSetting).toBeChecked();

    await page.goto("/leader/weekly");
    const link = page.getByRole("link", { name: "Attendance Matrix", exact: true });
    const historyHeading = page.getByRole("heading", { name: "Meeting History", exact: true });
    await expect(link).toBeVisible();
    await expect(historyHeading).toBeVisible();
    expect(await link.evaluate(node => node.nextElementSibling?.querySelector("h5")?.textContent?.trim() === "Meeting History")).toBe(true);

    await link.click();
    await expect(page).toHaveURL(/\/leader\/attendance\?view=matrix$/);
    await expect(page.getByTestId("attendance-matrix-only-view")).toBeVisible();
    await page.getByLabel("Search members").fill("SW260");
    const matrix = page.getByRole("table", { name: "Member attendance by meeting" });
    await expect(matrix).toBeVisible();
    await expect(matrix.getByRole("row")).toHaveCount(32);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByTestId("meeting-average-rate")).toHaveCount(0);
    await expect(page.getByTestId("attendance-member-card")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to Weekly Meetings", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Back to Weekly Meetings", exact: true }).click();
    await expect(historyHeading).toBeVisible();
    await expect(link).toBeVisible();

    await page.goto("/leader/settings");
    await matrixSetting.click();
    await expect(matrixSetting).toBeEnabled();
    await expect(matrixSetting).not.toBeChecked();
    await page.goto("/leader/weekly");
    await expect(page.getByRole("link", { name: "Attendance Matrix", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Meeting History", exact: true })).toBeVisible();
    await page.goto("/leader/attendance?view=matrix");
    await expect(page.getByTestId("attendance-matrix-disabled")).toBeVisible();
    await expect(page.getByRole("table", { name: "Member attendance by meeting" })).toHaveCount(0);
    await expect(page.getByTestId("meeting-average-rate")).toHaveCount(0);
    await page.goto("/leader/attendance");
    await expect(page.getByTestId("meeting-average-rate")).toBeVisible();

  } finally { await cleanup(); }
});
