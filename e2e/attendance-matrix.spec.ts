import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { seedAttendanceMatrix, matrixMeetingIds } from "./support/attendance-matrix-fixtures";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
const password = process.env.E2E_TEST_USER_PASSWORD;

test("Superuser rollout persists independently; matrix scroll, filters and rollback preserve summaries and records", async ({ page }, testInfo) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const cleanup = await seedAttendanceMatrix();
  const db = scheduleFixtureDb();
  const before = await Promise.all(matrixMeetingIds.map(async id => (await db.doc(`weeklyMeetings/${id}`).get()).data()));
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/leader/settings");
    const enable = page.getByRole("button", { name: "Attendance matrix", exact: true });
    const disable = page.getByRole("button", { name: "Existing attendance", exact: true });
    await expect(disable).toHaveAttribute("aria-pressed", "true");
    await enable.click();
    await expect(enable).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(enable).toHaveAttribute("aria-pressed", "true");
    for (const kind of ["navigation", "schedules"]) await expect(page.getByRole("button", { name: `Existing ${kind}`, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/leader/attendance");
    await page.getByLabel("Search members").fill("SW260");
    await page.getByTestId("attendance-from-date").fill("01-01-2098");
    await page.getByTestId("attendance-to-date").fill("31-01-2098");
    const table = page.getByRole("table", { name: "Member attendance by meeting" });
    const scroll = page.getByRole("region", { name: "Scrollable attendance matrix" });
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
    await scroll.evaluate(node => { node.scrollTop = 0; });
    const screenshot = await scroll.locator("..").screenshot({ path: testInfo.outputPath(`attendance-matrix-${testInfo.project.name}.png`) });
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
    await disable.click();
    await expect(disable).toHaveAttribute("aria-pressed", "true");
    await page.goto("/leader/attendance");
    await expect(scroll).toHaveCount(0);
    await expect(page.getByTestId("meeting-average-rate")).toBeVisible();
    await expect(page.getByTestId("attendance-member-card").first()).toBeVisible();
    expect(await Promise.all(matrixMeetingIds.map(async id => (await db.doc(`weeklyMeetings/${id}`).get()).data()))).toEqual(before);
  } finally { await cleanup(); }
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
    await expect(page.getByRole("button", { name: "Attendance matrix", exact: true })).toHaveCount(0);
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
    const enable = page.getByRole("button", { name: "Attendance matrix", exact: true });
    await enable.click();
    await expect(enable).toHaveAttribute("aria-pressed", "true");
    const leaderPage = await otherSession.newPage();
    await loginAsLeader(leaderPage, { email: process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com", password: password! });
    for (const navigation of [true, false]) {
      await db.doc("siteSettings/leaderNavigation").set({ version: navigation ? "redesigned" : "existing" });
      await db.doc("siteSettings/scheduleExperience").set({ version: navigation ? "existing" : "redesigned" });
      await leaderPage.goto("/leader/attendance");
      await expect(leaderPage.getByRole("table", { name: "Member attendance by meeting" })).toBeVisible();
    }
    await page.getByRole("button", { name: "Existing attendance", exact: true }).click();
    await expect(leaderPage.getByRole("table", { name: "Member attendance by meeting" })).toHaveCount(0);
    await expect(leaderPage.getByTestId("meeting-average-rate")).toBeVisible();
  } finally { await otherSession.close(); await cleanup(); }
});
