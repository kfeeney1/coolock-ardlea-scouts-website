import {expect, test} from "@playwright/test";
import {loginAsLeader} from "./support/authentication-helpers";
import {THEME_NAMES} from "../src/theme/themePreferences";
import {scheduleFixtureDb} from "./support/schedule-fixtures";
const paths = ["siteSettings/hallHire", "siteSettings/hallHirePublic", "siteSettings/hallHireReadiness", "hall/group", "hallAvailability/2026-11-05", "hall/group/bookings/e2e-public", "siteSettings/hallHireVenue"];
let previous: FirebaseFirestore.DocumentSnapshot[] = [];
test.beforeEach(async () => {
  const db = scheduleFixtureDb(); previous = await Promise.all(paths.map(path => db.doc(path).get()));
  await db.doc(paths[0]).set({enabled: true}); await db.doc(paths[1]).set({enabled: true}); await db.doc(paths[2]).set({ready: true}); await db.doc(paths[3]).set({ready: true});
  await db.doc(paths[4]).set({occupied: [{start: "2026-11-05T19:00:00.000Z", end: "2026-11-05T20:00:00.000Z"}, {start: "2026-11-05T21:00:00.000Z", end: "2026-11-05T22:00:00.000Z"}]});
  await db.doc(paths[5]).set({title: "PRIVATE_PROGRAMME", hirerName: "PRIVATE_HIRER", contact: "private@example.com", notes: "PRIVATE_NOTES"});
  await db.doc(paths[6]).set({confirmed: false, name: "UNAPPROVED_VENUE_FACTS"});
});
test.afterEach(async () => {if (!previous.length) return; const db = scheduleFixtureDb(); for (let index = 0; index < paths.length; index++) {if (previous[index].exists) await db.doc(paths[index]).set(previous[index].data()!); else await db.doc(paths[index]).delete();} previous = [];});
test("public month shows occupied and unreserved times, never private details, at Android width", async ({page}, testInfo) => {
  const requests: string[] = []; page.on("request", request => {if (request.url().includes(":8080")) requests.push(request.postData() ?? "");});
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({width: 320, height: 800});
  await page.goto("/hall-hire"); await expect(page.getByTestId("public-hall-hire")).toBeVisible();
  const check = page.getByRole("link", {name: "Check availability", exact: true}); await check.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", {name: "Availability", exact: true})).toBeFocused();
  await page.getByRole("textbox", {name: "Requested date", exact: true}).fill("05-11-2026");
  const details = page.getByRole("region", {name: "Times for 05-11-2026", exact: true});
  await expect(details).toContainText("Occupied · 19:00–20:00"); await expect(details).toContainText("Occupied · 21:00–22:00");
  await expect(details).toContainText("Unreserved · 20:00–21:00");
  await expect(page.getByRole("link", {name: "Enquire by email", exact: true})).toHaveAttribute("href", /mailto:.*subject=Hall%20hire%20enquiry/);
  await expect(page.getByTestId("public-hall-hire")).toContainText("An enquiry does not confirm a booking.");
  for (const privateValue of ["PRIVATE_PROGRAMME", "PRIVATE_HIRER", "PRIVATE_NOTES", "private@example.com", "UNAPPROVED_VENUE_FACTS"]) await expect(page.locator("body")).not.toContainText(privateValue);
  expect(requests.join(" ")).not.toContain("hall/group/bookings");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", {name: "Next month", exact: true}).click();
  await expect(page.getByRole("heading", {name: "December 2026", exact: true})).toBeVisible();
});
test("disabled Hall Hire preserves public navigation and does not query availability", async ({page}) => {
  const db = scheduleFixtureDb(); await db.doc(paths[0]).set({enabled: false}); await db.doc(paths[1]).set({enabled: false});
  const requests: string[] = []; page.on("request", request => requests.push(request.postData() ?? ""));
  await page.goto("/hall-hire"); await expect(page.getByRole("alert")).toContainText("Hall Hire is currently unavailable");
  await expect(page.getByRole("table", {name: "Hall availability calendar"})).toHaveCount(0);
  await expect(page.getByRole("link", {name: "Hall Hire", exact: true})).toHaveCount(0);
  expect(requests.join(" ")).not.toContain("hallAvailability");
});
test("unverifiable availability is shown as an error rather than an empty free calendar", async ({page}) => {
  await scheduleFixtureDb().doc(paths[0]).set({enabled: false}); // Stale public projection cannot override authoritative read rules.
  await page.goto("/hall-hire"); await expect(page.getByRole("alert")).toContainText("Unable to load live hall availability");
  await expect(page.getByRole("table", {name: "Hall availability calendar"})).toHaveCount(0);
  await expect(page.getByRole("link", {name: "Enquire by email", exact: true})).toBeVisible();
});

for (const uiTheme of THEME_NAMES) test(`calendar keeps keyboard focus and fits every theme (${uiTheme})`, async ({page}, testInfo) => {
  test.skip(!process.env.E2E_TEST_USER_PASSWORD, "Configure canonical E2E credentials.");
  const profile = scheduleFixtureDb().doc("adminUsers/TEST_uid_super_admin_01"), previousProfile = await profile.get();
  try {
    await profile.update({uiTheme});
    await loginAsLeader(page, {email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: process.env.E2E_TEST_USER_PASSWORD!});
    if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({width: 320, height: 800});
    await page.goto("/hall-hire");
    await expect(page.locator("html")).toHaveAttribute("data-ui-theme", uiTheme);
    await page.getByRole("textbox", {name: "Requested date", exact: true}).fill("05-11-2026");
    const day = page.getByRole("button", {name: "Show times for 05-11-2026", exact: true});
    await expect(day).toBeEnabled(); await day.focus(); await expect(day).toBeFocused();
    expect(await day.evaluate(element => Number.parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(3);
    await page.keyboard.press("Space");
    await expect(day).toHaveAttribute("aria-pressed", "true");
    const times = page.getByRole("region", {name: "Times for 05-11-2026", exact: true});
    await expect(times).toBeFocused();
    await expect(times).toContainText("Occupied · 19:00–20:00");
    await expect(times).toContainText("Occupied · 21:00–22:00");
    await expect(times).toContainText("Unreserved · 20:00–21:00");
    const next = page.getByRole("button", {name: "Next month", exact: true});
    await next.focus();
    expect(await next.evaluate(element => Number.parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(3);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", {name: "December 2026", exact: true})).toBeVisible();
    await expect(page.getByRole("region", {name: "Times for 01-12-2026", exact: true})).toBeVisible();
    await expect(next).toBeFocused();
    const previousMonth = page.getByRole("button", {name: "Previous month", exact: true});
    await previousMonth.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("region", {name: "Times for 01-11-2026", exact: true})).toBeVisible();
    await expect(previousMonth).toBeFocused();
    for (const value of ["PRIVATE_PROGRAMME", "PRIVATE_HIRER", "PRIVATE_NOTES", "private@example.com", "UNAPPROVED_VENUE_FACTS"]) await expect(page.locator("body")).not.toContainText(value);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: testInfo.outputPath(`hall-${uiTheme}.png`), fullPage: true});
  } finally {
    if (previousProfile.exists) await profile.set(previousProfile.data()!); else await profile.delete();
  }
});
test("revoked readiness removes public availability without removing retained records", async ({page}) => {
  const db = scheduleFixtureDb(), booking = await db.doc(paths[5]).get(), occupied = await db.doc(paths[4]).get();
  await page.goto("/hall-hire"); await expect(page.getByRole("table", {name: "Hall availability calendar"})).toBeVisible();
  await db.doc(paths[2]).set({ready: false});
  await expect(page.getByRole("alert")).toContainText("Hall Hire is currently unavailable");
  await expect(page.getByRole("table", {name: "Hall availability calendar"})).toHaveCount(0);
  await expect(page.getByRole("link", {name: "Hall Hire", exact: true})).toHaveCount(0);
  expect((await booking.ref.get()).data()).toEqual(booking.data());
  expect((await occupied.ref.get()).data()).toEqual(occupied.data());
});
test("pending live month never presents an empty calendar as available", async ({page, context}) => {
  await page.goto("/hall-hire");
  await page.getByRole("textbox", {name: "Requested date", exact: true}).fill("05-11-2026");
  await expect(page.getByRole("region", {name: "Times for 05-11-2026", exact: true})).toContainText("Occupied · 19:00–20:00");
  const calendar = page.getByRole("table", {name: "Hall availability calendar", exact: true});
  try {
    await context.setOffline(true);
    const next = page.getByRole("button", {name: "Next month", exact: true});
    await next.focus();
    expect(await next.evaluate(element => Number.parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(3);
    await page.keyboard.press("Enter");
    await expect(calendar).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("status").filter({hasText: "Loading live availability"})).toBeVisible();
    await expect(calendar).not.toContainText("Unreserved time");
    await expect(calendar).not.toContainText("Occupied");
    await expect(page.getByRole("region", {name: /^Times for/})).toHaveCount(0);
    await expect(page.getByRole("button", {name: "Show times for 01-12-2026", exact: true})).toBeDisabled();
    await expect(next).toBeFocused();
    await context.setOffline(false);
    await expect(calendar).toHaveAttribute("aria-busy", "false");
    await expect(page.getByRole("region", {name: "Times for 01-12-2026", exact: true})).toBeVisible();
    await expect(next).toBeFocused();
  } finally {await context.setOffline(false);}
});
