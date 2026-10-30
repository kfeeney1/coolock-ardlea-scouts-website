import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import type { HallBookingRecord } from "../src/services/hallBookingAdministration";
const password = process.env.E2E_TEST_USER_PASSWORD;
const paths = ["siteSettings/hallHire", "siteSettings/hallHirePublic", "siteSettings/hallHireReadiness", "hall/group"];
let previous: FirebaseFirestore.DocumentSnapshot[] = [];
test.beforeEach(async () => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const db = scheduleFixtureDb(); previous = await Promise.all(paths.map(path => db.doc(path).get()));
  await db.doc(paths[0]).set({enabled: true}); await db.doc(paths[1]).set({enabled: true});
  await db.doc(paths[2]).set({ready: true}); await db.doc(paths[3]).set({ready: true, revision: 0});
});
test.afterEach(async () => {if (!previous.length) return; const db = scheduleFixtureDb(); for (let index = 0; index < previous.length; index++) {if (previous[index].exists) await db.doc(paths[index]).set(previous[index].data()!); else await db.doc(paths[index]).delete();} previous = [];});
async function backend(page: Page) {
  let current: HallBookingRecord | null = null, conflict = false;
  const commands: Record<string, unknown>[] = [];
  await page.route("**/hall-bookings", async route => {
    const headers = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS"};
    if (route.request().method() === "OPTIONS") {await route.fulfill({status: 204, headers}); return;}
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const body = route.request().postDataJSON();
    if (body.action === "save") {
      commands.push(body.command);
      if (conflict) {await route.fulfill({status: 409, headers, json: {ok: false}}); return;}
      current = {...body.command.booking, revision: body.command.expectedRevision + 1, createdBy: "TEST_uid_cub_section_leader", updatedBy: "TEST_uid_cub_section_leader", createdAt: "2026-10-29T12:00:00Z", updatedAt: "2026-10-29T12:00:00Z"};
      await route.fulfill({headers, json: {ok: true, id: current!.id, revision: current!.revision}}); return;
    }
    await route.fulfill({headers, json: body.action === "get" ? {ok: true, item: current} : body.action === "history" ? {ok: true, items: current ? [{key: "1", value: {actorUid: current.updatedBy, at: current.updatedAt, previous: null, next: current}}] : [], cursor: ""} : {ok: true, items: current ? [{key: current.id, value: current}] : [], cursor: ""}});
  });
  return {commands, setConflict: () => {conflict = true;}};
}
test("Council can create and edit a weekly occurrence; conflicts retain edits at 320px", async ({page}, testInfo) => {
  const mock = await backend(page);
  await loginAsLeader(page, {email: "test.cub.section.leader@example.com", password: password!});
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({width: 320, height: 800});
  await page.getByRole("link", {name: "Hall bookings", exact: true}).click();
  await page.getByRole("link", {name: "New hall booking", exact: true}).click();
  await page.getByRole("textbox", {name: "Booking title", exact: true}).fill("Hall UI test");
  await page.getByRole("combobox", {name: "Booking status", exact: true}).click();
  await page.getByRole("option", {name: "Confirmed — reserves time", exact: true}).click();
  await page.getByRole("textbox", {name: "Start date", exact: true}).fill("05-11-2026");
  await page.getByRole("textbox", {name: "End date", exact: true}).fill("05-11-2026");
  await page.getByRole("switch", {name: "Repeat weekly", exact: true}).check();
  await page.getByRole("textbox", {name: "Repeat until", exact: true}).fill("19-11-2026");
  await page.getByRole("button", {name: "Save booking", exact: true}).click();
  await expect(page.getByRole("status").filter({hasText: "Hall booking saved."})).toBeVisible();
  expect(mock.commands[0]).toMatchObject({expectedRevision: 0, booking: {title: "Hall UI test", state: "confirmed", recurrence: {frequency: "weekly", until: "2026-11-19"}}});
  await page.getByRole("combobox", {name: "Edit scope", exact: true}).click();
  await page.getByRole("option", {name: "One occurrence", exact: true}).click();
  await page.getByRole("combobox", {name: "Original occurrence date", exact: true}).click();
  await page.getByRole("option", {name: "12-11-2026", exact: true}).click();
  await page.getByRole("switch", {name: "Cancel this occurrence", exact: true}).check();
  await page.getByRole("button", {name: "Save occurrence", exact: true}).click();
  await expect.poll(() => mock.commands.length).toBe(2);
  expect(mock.commands[1]).toMatchObject({expectedRevision: 1, booking: {exceptions: [{date: "2026-11-12", action: "cancel"}]}});
  await expect(page.getByRole("heading", {name: "Edit booking series", exact: true})).toBeVisible();
  await expect(page.getByRole("combobox", {name: "Edit scope", exact: true})).toHaveText("Entire series");
  mock.setConflict();
  await page.getByRole("textbox", {name: "Booking title", exact: true}).fill("Retain my conflict edits");
  await page.getByRole("button", {name: "Save series", exact: true}).click();
  await expect(page.getByRole("alert")).toContainText("Your edits are retained");
  await expect(page.getByRole("status").filter({hasText: "Hall booking saved."})).toHaveCount(0);
  await expect(page.getByRole("textbox", {name: "Booking title", exact: true})).toHaveValue("Retain my conflict edits");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("textbox", {name: "Booking title", exact: true}).fill("Hall UI test");
});
test("non-Council and disabled routes do not fetch or render private booking data", async ({page}) => {
  let privateCalls = 0; await page.route("**/hall-bookings", async route => {privateCalls++; await route.fulfill({status: 403, json: {ok: false}});});
  await loginAsLeader(page, {email: "test.cub.programme.scouter@example.com", password: password!});
  await expect(page.getByRole("link", {name: "Hall bookings", exact: true})).toHaveCount(0);
  await page.goto("/leader/hall"); await expect(page.getByRole("alert")).toContainText("Group Council membership");
  await expect(page.getByTestId("hall-booking-list")).toHaveCount(0); expect(privateCalls).toBe(0);
  await scheduleFixtureDb().doc("siteSettings/hallHirePublic").set({enabled: false});
  await expect(page.getByRole("alert")).toContainText("Hall Hire is currently disabled"); expect(privateCalls).toBe(0);
});
