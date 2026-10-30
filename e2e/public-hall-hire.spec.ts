import {expect, test} from "@playwright/test";
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
