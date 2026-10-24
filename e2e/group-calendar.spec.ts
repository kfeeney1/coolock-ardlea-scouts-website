import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { scheduleToday } from "../src/services/scheduleSelection";
import { calendarMonthCaption } from "../src/services/groupCalendar";
for (const version of ["existing", "redesigned"]) test(`Calendar default-off rollout, monthly navigation and return context (${version})`, async ({ page }, testInfo) => {
  const password = process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!password, "Configure canonical E2E credentials.");
  const db = scheduleFixtureDb();
  const refs = ["siteSettings/calendarExperience", "siteSettings/leaderNavigation", "siteSettings/maintenanceExperience"].map(path => db.doc(path));
  const previous = await Promise.all(refs.map(ref => ref.get()));
  try {
    await refs[0].delete(); await refs[1].set({version}); await refs[2].set({version: "existing"});
    await page.goto("/calendar");
    await expect(page.getByText("Sign in to access Calendar.", {exact: true})).toBeVisible();
    await loginAsLeader(page, {email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password!});
    await expect(page.getByTestId("dashboard-calendar")).toHaveCount(0);
    await page.goto("/calendar");
    await expect(page.getByText("Calendar is currently disabled.", {exact: true})).toBeVisible();
    await page.goto("/leader/settings");
    await expect(page.getByRole("button", {name: "Calendar disabled", exact: true})).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", {name: "Calendar enabled", exact: true}).click();
    await expect(page.getByRole("button", {name: "Calendar enabled", exact: true})).toHaveAttribute("aria-pressed", "true");
    await page.goto("/leader");
    const dashboardCalendar = page.getByTestId("dashboard-calendar");
    await expect(dashboardCalendar).toBeVisible();
    await expect(dashboardCalendar).toHaveAttribute("href", "/calendar");
    await dashboardCalendar.focus(); await page.keyboard.press("Enter");
    await expect(page.getByTestId("page-group-calendar")).toBeVisible();
    await page.getByRole("link", {name: "Back to Dashboard", exact: true}).click();
    await page.locator('button[aria-controls="leader-navigation"]').click();
    const group = page.getByRole("navigation", {name: "Leader navigation", exact: true}).getByRole("button", {name: /^Group Operations/}).filter({visible: true}).first();
    if (version === "redesigned" || testInfo.project.name === "mobile-chromium") {
      await expect(group).toBeVisible(); if (await group.getAttribute("aria-expanded") !== "true") await group.click();
    }
    await page.getByRole("link", {name: "Calendar", exact: true}).filter({visible: true}).first().click();
    await expect(page.getByTestId("page-group-calendar")).toBeVisible();
    await expect(page.getByRole("heading", {name: calendarMonthCaption(scheduleToday().slice(0, 7)), exact: true})).toBeVisible();
    const grid = page.getByRole("table", {name: "Monthly group calendar"});
    await expect(grid.getByRole("columnheader").first()).toHaveText("Mon");
    await expect(grid.locator('time[aria-current="date"]')).toHaveAttribute("datetime", scheduleToday());
    await page.getByRole("button", {name: "Next month", exact: true}).click();
    await page.getByRole("button", {name: "Events", exact: true}).click();
    await expect(page.getByRole("button", {name: "Events", exact: true})).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({path: testInfo.outputPath("calendar-month.png"), fullPage: true});
    const context = page.url(); await page.reload();
    await expect(page.getByRole("button", {name: "Events", exact: true})).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(context);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", {name: "Back to Dashboard", exact: true}).click();
    await page.goBack(); await expect(page).toHaveURL(context);
    await page.getByRole("button", {name: "Today", exact: true}).click();
    await expect(grid.locator('time[aria-current="date"]')).toBeVisible();
    await refs[0].set({version: "existing"});
    await expect(page.getByText("Calendar is currently disabled.", {exact: true})).toBeVisible();
    await page.goto("/leader"); await page.locator('button[aria-controls="leader-navigation"]').click();
    await expect(page.getByRole("link", {name: "Calendar", exact: true}).filter({visible: true})).toHaveCount(0);
    expect((await refs[2].get()).data()?.version).toBe("existing");
  } finally {
    for (const [index, ref] of refs.entries()) if (previous[index].exists) await ref.set(previous[index].data()!); else await ref.delete();
  }
});

for (const uiTheme of ["default", "modern"]) test(`Calendar compact monthly layout and keyboard filters (${uiTheme})`, async ({page}, testInfo) => {
  test.skip(!process.env.E2E_TEST_USER_PASSWORD, "Configure canonical E2E credentials.");
  const db = scheduleFixtureDb();
  const paths = ["siteSettings/calendarExperience", "siteSettings/leaderNavigation", "siteSettings/maintenanceExperience", "adminUsers/TEST_uid_super_admin_01"];
  const previous = await Promise.all(paths.map(path => db.doc(path).get()));
  try {
    await db.doc(paths[0]).set({version: "redesigned"}); await db.doc(paths[1]).set({version: "redesigned"});
    await db.doc(paths[2]).set({version: "existing"}); await db.doc(paths[3]).update({uiTheme});
    await loginAsLeader(page, {email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: process.env.E2E_TEST_USER_PASSWORD!});
    await page.goto("/calendar");
    await expect(page.getByRole("heading", {name: "Group calendar", exact: true})).toBeVisible();
    await expect(page.getByText("Leader Dashboard", {exact: true})).toHaveCount(0);
    const grid = page.getByRole("table", {name: "Monthly group calendar"});
    const filters = page.getByRole("navigation", {name: "Calendar type filters"});
    const controls = await filters.getByRole("button").evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect(); return {top: rect.top, height: rect.height, width: rect.width};
    }));
    expect(controls).toHaveLength(4);
    expect(new Set(controls.map(control => Math.round(control.top))).size).toBe(1);
    expect(controls.every(control => control.height >= 44 && control.width >= 44)).toBe(true);
    for (const name of ["Previous month", "Next month"]) await expect(page.getByRole("button", {name, exact: true})).toHaveCSS("min-width", "44px");
    expect(await grid.evaluate(node => node.getBoundingClientRect().top < innerHeight * 0.75)).toBe(true);
    await page.getByRole("button", {name: "Events", exact: true}).focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("button", {name: "Events", exact: true})).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByText("Loading Calendar records…", {exact: true})).toHaveCount(0);
    await page.screenshot({path: testInfo.outputPath("calendar-compact.png"), fullPage: true});
  } finally {
    const batch = db.batch(); previous.forEach(snapshot => snapshot.exists ? batch.set(snapshot.ref, snapshot.data()!) : batch.delete(snapshot.ref)); await batch.commit();
  }
});
