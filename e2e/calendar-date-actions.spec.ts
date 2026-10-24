import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { calendarDateFixtures, dateActionContext } from "./support/calendar-date-fixtures";
import { decodeProgramme } from "../src/services/weeklyMeetingProgrammeText";
import { formatSiteDate } from "../src/services/siteDateFormat";
const credentials = () => ({email: "superadmin@example.com", password: process.env.E2E_TEST_USER_PASSWORD!});
test("SW-539 empty cell, four-entry day, entry navigation and keyboard focus", async ({page}) => {
  const fixture = await calendarDateFixtures();
  try {
    await loginAsLeader(page, credentials()); await page.goto(dateActionContext);
    const populated = page.locator('[data-calendar-date="2040-06-15"]'), empty = page.locator('[data-calendar-date="2040-06-16"]');
    await expect(populated.getByRole("link")).toHaveCount(4);
    await populated.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/leader\/weekly\?meeting=sw539-0/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("link", {name: "Back to calendar", exact: true}).click(); await expect(page).toHaveURL(dateActionContext);
    // Blank cell background, independently of its date-number button.
    await empty.click({position: {x: 3, y: 70}});
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText(formatSiteDate("2040-06-16"));
    await expect(dialog.getByRole("link", {name: "Add maintenance", exact: true})).toHaveCount(0);
    await expect(dialog.getByRole("link", {name: "Add event", exact: true})).toHaveAttribute("href", "/leader/events/create");
    await expect(dialog.getByRole("button", {name: "Close", exact: true})).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(empty.getByRole("button")).toBeFocused();
    const number = populated.getByRole("button", {name: `Actions for ${formatSiteDate("2040-06-15")}`, exact: true});
    await number.focus(); await page.keyboard.press("Enter");
    await expect(dialog.getByRole("heading")).toHaveText(formatSiteDate("2040-06-15"));
    await dialog.getByRole("button", {name: "Close", exact: true}).click(); await expect(number).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {await fixture.restore();}
});
for (const action of ["meeting", "event", "maintenance"]) test(`SW-539 ${action} date prefill and untouched cancel preserve filters`, async ({page}) => {
  const fixture = await calendarDateFixtures();
  try {
    if (action === "maintenance") await fixture.settings[1].set({version: "redesigned", sdkRevision: 1});
    await loginAsLeader(page, credentials()); await page.goto(dateActionContext);
    await expect(page.getByText("Loading Calendar records…", {exact: true})).toHaveCount(0);
    await page.getByRole("button", {name: `Actions for ${formatSiteDate("2040-06-15")}`, exact: true}).click();
    await page.getByRole("dialog").getByRole("link", {name: `Add ${action}`, exact: true}).click();
    const field = page.getByRole("textbox", {name: action === "meeting" ? /^Meeting date/ : action === "event" ? /^Start date/ : /^Appointment date/});
    await expect(field).toHaveValue(formatSiteDate("2040-06-15"));
    if (action === "meeting") await expect(page.getByRole("combobox", {name: "Section", exact: true})).not.toHaveText("");
    // Inputs retain normal editable dates; reset the hint before untouched cancel.
    await field.fill(formatSiteDate("2040-06-17")); await expect(field).toHaveValue(formatSiteDate("2040-06-17"));
    await field.fill(formatSiteDate("2040-06-15"));
    if (action === "event") {
      await page.getByRole("textbox", {name: /^End date/}).fill(formatSiteDate("2040-06-15"));
      await page.getByRole("button", {name: "Back to calendar", exact: true}).click();
    }
    else await page.getByRole(action === "maintenance" ? "link" : "button", {name: "Cancel", exact: true}).click();
    await expect(page).toHaveURL(dateActionContext);
  } finally {await fixture.restore();}
});
test("SW-539 parent date actions do not expose leader creation or disabled maintenance", async ({page}) => {
  const fixture = await calendarDateFixtures();
  try {
    await page.goto("/parent"); await page.getByLabel("Email", {exact: true}).fill(process.env.E2E_PARENT_EMAIL!);
    await page.getByLabel("Password", {exact: true}).fill(process.env.E2E_TEST_USER_PASSWORD!);
    await page.getByRole("button", {name: "Sign In", exact: true}).click();
    await expect(page.getByRole("button", {name: "Sign Out", exact: true}).first()).toBeVisible();
    await page.goto(dateActionContext);
    await page.getByRole("button", {name: `Actions for ${formatSiteDate("2040-06-16")}`, exact: true}).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link")).toHaveCount(0);
    await expect(dialog.getByText("No creation actions are available for your account.", {exact: true})).toBeVisible();
    await dialog.getByRole("button", {name: "Close", exact: true}).click();
  } finally {await fixture.restore();}
});
for (const action of ["meeting", "event", "maintenance"]) test(`SW-539 ${action} saves through canonical workflow and keeps Calendar context`, async ({page}, testInfo) => {
  const fixture = await calendarDateFixtures();
  const collection = action === "meeting" ? "weeklyMeetings" : action === "event" ? "events" : "maintenance/group/appointments";
  const title = `SW539 saved ${action} ${testInfo.testId}`;
  // Weekly meeting titles are encoded in the canonical programmeNotes payload.
  // Read by date, then decode the saved title; use the same identity for cleanup.
  const savedRecords = async () => {
    const snapshot = await fixture.db.collection(collection).where(action === "meeting" ? "meetingDate" : "title", "==", action === "meeting" ? "2040-06-16" : title).get();
    return snapshot.docs.filter(record => action !== "meeting" || decodeProgramme(record.data().programmeNotes).theme === title);
  };
  try {
    if (action === "maintenance") await fixture.settings[1].set({version: "redesigned", sdkRevision: 1});
    await loginAsLeader(page, credentials()); await page.goto(dateActionContext);
    await expect(page.getByText("Loading Calendar records…", {exact: true})).toHaveCount(0);
    await page.getByRole("button", {name: `Actions for ${formatSiteDate("2040-06-16")}`, exact: true}).click();
    await page.getByRole("dialog").getByRole("link", {name: `Add ${action}`, exact: true}).click();
    if (action === "meeting") await page.getByRole("textbox", {name: "Theme / programme title", exact: true}).fill(title);
    else await page.getByRole("textbox", {name: action === "event" ? /^Event title/ : /^Appointment title/}).fill(title);
    await page.getByRole("button", {name: action === "meeting" ? "Create Meeting" : action === "event" ? "Create Event" : "Save appointment", exact: true}).click();
    await expect(page).toHaveURL(dateActionContext);
    const records = await savedRecords();
    expect(records).toHaveLength(1);
    expect(records[0].data()[action === "meeting" ? "meetingDate" : action === "event" ? "startDate" : "date"]).toBe("2040-06-16");
  } finally {
    const records = await savedRecords();
    for (const record of records) {
      await fixture.db.recursiveDelete(record.ref);
      if (action === "meeting") await fixture.db.doc(`parentWeeklyMeetings/${record.id}`).delete();
      if (action === "event") for (const projection of ["publicEvents", "parentGalleryEvents", "eventProgrammes"]) await fixture.db.doc(`${projection}/${record.id}`).delete();
    }
    await fixture.restore();
  }
});
