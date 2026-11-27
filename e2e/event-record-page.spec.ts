import { expect, test, type TestInfo } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { persistedAudienceMemberIds } from "./support/event-audience-assertions";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Event record navigation runs once on desktop Chromium.");
}

const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

test("clicking an event tile opens its full record with a clear list action", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events");

  const card = page.getByTestId("event-card-TEST_flow_event_beavers_open");
  await expect(card).toHaveAttribute("href", "/leader/events/TEST_flow_event_beavers_open");
  await expect(card.getByText("Open event", { exact: true })).toBeVisible();
  await expect(card).toContainText(/\d{2}-\d{2}-\d{4}/);
  await expect(card).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await card.click();

  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);
  const eventRecord = page.getByTestId("event-record-TEST_flow_event_beavers_open");
  await expect(eventRecord).toBeVisible();
  await expect(eventRecord).toContainText(/\d{2}-\d{2}-\d{4}/);
  await expect(eventRecord).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("heading", { name: "TEST Beavers Open Day Trip" })).toBeVisible();
  const backToEvents = page.getByRole("link", { name: "Back to Events", exact: true });
  await expect(backToEvents).toHaveAttribute("href", "/leader/events");
  const backBox = await backToEvents.boundingBox();
  expect(backBox?.height).toBeGreaterThanOrEqual(44);
  await backToEvents.focus();
  await expect(backToEvents).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/leader\/events$/);
  await page.goto("/leader/events/TEST_flow_event_beavers_open");
  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);
  await expect(page.getByRole("button", { name: "Attendance", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage Consent", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Record Badgework", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gallery", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Equipment", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Report", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit Event", exact: true })).toBeVisible();
});

test("event editor saves valid edits before app and browser back navigation", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");
  const title = `TEST event autosave ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-10");
  await page.getByRole("button", { name: "Create Event", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events\/(?!create$)[^/]+$/);
  const eventUrl = page.url();
  const eventId = new URL(eventUrl).pathname.split("/").pop()!;
  const persistedIds = await persistedAudienceMemberIds(eventId);
  expect(persistedIds.length).toBeGreaterThan(0);
  await expect(page.getByTestId(`event-record-${eventId}`)).toContainText(`${persistedIds.length} invited`);
  const eventPath = new URL(eventUrl).pathname;
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/edit$`));
  await expect(page.getByRole("heading", { name: new RegExp(`Edit event · ${title}`) })).toBeVisible();
  await page.getByLabel("Event title").fill("");
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  let leaveDialog = page.getByRole("alertdialog", { name: "Unsaved event changes" });
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(leaveDialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/edit$`));
  await expect(page.getByRole("alert").filter({ hasText: "Event title and start date are required" })).toBeVisible();
  const updatedTitle = `${title} updated`;
  await page.getByLabel("Event title").fill(updatedTitle);
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  leaveDialog = page.getByRole("alertdialog", { name: "Unsaved event changes" });
  await leaveDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const browserBackTitle = `${updatedTitle} browser back`;
  await page.getByLabel("Event title").fill(browserBackTitle);
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.stringify(window.history.state))).toContain("__eventEditBackGuard");
  await page.goBack();
  leaveDialog = page.getByRole("alertdialog", { name: "Unsaved event changes" });
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: browserBackTitle })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: browserBackTitle })).toBeVisible();

});

test("event leader attendance persists independently across reload", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");
  const title = `TEST leader attendance persistence ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-12");
  await page.getByRole("button", { name: "Create Event", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  const leaderPanel = page.getByTestId("leader-attendance-section");
  await expect(leaderPanel.getByRole("heading", { name: "Leader Attendance" })).toBeVisible();
  await leaderPanel.getByLabel("Search active leaders").fill("Beavers Assistant Section Leader");
  await expect(leaderPanel.getByText("Beavers Assistant Section Leader", { exact: true })).toBeVisible();
  const helperRow = leaderPanel.getByTestId("leader-attendance-row").filter({ hasText: "Beavers Assistant Section Leader" });
  if (await helperRow.count() === 0) await leaderPanel.getByRole("button", { name: "Add Beavers Assistant Section Leader" }).click();
  await helperRow.getByRole("combobox", { name: "Leader attendance" }).click();
  await page.getByRole("option", { name: "Present", exact: true }).click();
  await page.getByRole("button", { name: "Save Attendance" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Attendance and consent roster updated." })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  const restoredHelper = page.getByTestId("leader-attendance-section").getByTestId("leader-attendance-row").filter({ hasText: "Beavers Assistant Section Leader" });
  await expect(restoredHelper.getByRole("combobox", { name: "Leader attendance" })).toHaveText("Present");
});

test("mobile event editor saves valid edits before navigating away", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Event auto-save mobile regression runs on the canonical mobile project.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");
  const title = `TEST mobile event autosave ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-11");
  await page.getByRole("button", { name: "Create Event", exact: true }).click();
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const updatedTitle = `${title} updated`;
  await page.getByLabel("Event title").fill(updatedTitle);
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  const leaveDialog = page.getByRole("alertdialog", { name: "Unsaved event changes" });
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
});

test("event attendance dialog keeps named print and CSV unavailable", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/TEST_flow_event_beavers_open");

  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Attendance & Consent" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Report", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Export CSV", exact: true })).toHaveCount(0);
});


test("Add Event opens the dedicated full-page editor on desktop and mobile", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events");
  await page.getByRole("link", { name: "Add Event", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/create$/);
  await expect(page.getByTestId("event-create-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create Event" })).toBeVisible();
  await expect(page.getByTestId("event-editor-dialog")).toHaveCount(0);
  await expect(page.getByLabel("Event title")).toBeVisible();
  await expect(page.getByText("Event audience", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Clear resets the full-page event form without persisting or leaving it", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");
  await page.getByLabel("Event title").fill("TEST clear-only event");
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-04-02");
  await page.getByLabel("Location").fill("Temporary location");
  await page.getByLabel("Description").fill("Temporary description");
  await page.getByRole("button", { name: "Clear", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/create$/);
  await expect(page.getByLabel("Event title")).toHaveValue("");
  await expect(page.getByRole("textbox", { name: /^Start date/ })).toHaveValue("");
  await expect(page.getByLabel("Location")).toHaveValue("");
  await expect(page.getByLabel("Description")).toHaveValue("");
});

test("Back and Cancel avoid empty events and save a valid draft before leaving", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");
  await page.getByRole("button", { name: "Back to Events", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events$/);

  await page.getByRole("link", { name: "Add Event", exact: true }).click();
  const title = `TEST cancelled event ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-04-05");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events$/);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("full-page Create Event preserves fields and audience and saves to the event record", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");

  const title = `TEST full-page event ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("combobox", { name: "Event type" }).click();
  await page.getByRole("option", { name: "Day Trip", exact: true }).click();
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Beavers", exact: true }).click();
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-10");
  await page.getByRole("textbox", { name: "End date", exact: true }).fill("10-05-2099");
  await page.getByLabel("Location").fill("TEST full-page location");
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Open", exact: true }).click();
  await page.getByLabel("Event consent required").check();
  await page.getByLabel("Meeting / departure details").fill("TEST departure");
  await page.getByLabel("Return / collection details").fill("TEST return");
  await page.getByLabel("Description").fill("TEST event description");
  await page.getByLabel("Leader notes").fill("TEST leader notes");

  await page.getByRole("button", { name: "Clear sections", exact: true }).click();
  await page.getByRole("checkbox", { name: /^Beavers \(\d+\)$/ }).check();
  await expect(page.getByTestId("event-audience-summary")).toContainText(/Audience: Beavers — \d+ members/);
  await page.getByRole("button", { name: "Create Event", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/[^/]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("TEST full-page location", { exact: true })).toBeVisible();
  const eventId = page.url().split("/").at(-1)!;
  await page.goto(`/leader/events/${encodeURIComponent(eventId)}/edit`);
  await expect(page.getByRole("textbox", { name: /^Start date/ })).toHaveValue("10-05-2099");
  const savedEnd = page.getByRole("textbox", { name: "End date", exact: true });
  await expect(savedEnd).toHaveValue("10-05-2099");
  await page.getByRole("button", { name: "Choose end date" }).click();
  const endCalendar = page.getByRole("dialog", { name: "Choose end date" });
  await endCalendar.getByRole("button", { name: "Select 11-05-2099" }).click();
  await endCalendar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(savedEnd).toHaveValue("10-05-2099");
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-11");
  await expect(page.getByRole("textbox", { name: "End date", exact: true })).toHaveValue("");
  await page.getByRole("textbox", { name: "End date", exact: true }).fill("09-05-2099");
  await page.getByRole("button", { name: "Save Event", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "End date cannot be before the start date" })).toContainText("End date cannot be before the start date");
});

test("direct Create Event route remains protected", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto("/leader/events/create");
  await expect(page).toHaveURL(/\/leader\/login/);
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("Edit Event rollout preserves navigation and reflows at 320px", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Run on desktop and mobile Chromium.");
  test.skip(!password || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080", "Requires the seeded local emulator.");
  const { scheduleFixtureDb } = await import("./support/schedule-fixtures");
  const setting = scheduleFixtureDb().doc("siteSettings/eventEditExperience");
  const previous = await setting.get();
  const recordPath = "/leader/events/TEST_flow_event_beavers_open";
  try {
    await setting.set({ version: "existing" });
    await loginAsLeader(page, { email: adminEmail, password: password! });
    await page.goto(recordPath + "/edit");
    const title = page.getByRole("textbox", { name: /Event title/ });
    await expect(title).toBeVisible();
    const details = page.getByRole("heading", { name: "Event details", exact: true });
    await expect(details).toHaveCount(0);

    await setting.set({ version: "redesigned" });
    await expect(details).toBeVisible();
    if (testInfo.project.name === "mobile-chromium") {
      await page.setViewportSize({ width: 320, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    }
    const save = page.getByRole("button", { name: "Save Event", exact: true });
    const back = page.getByRole("link", { name: "Back to Event", exact: true });
    await expect(save).toBeVisible();
    expect((await save.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    await title.fill("Synthetic unsaved Edit Event draft");
    await back.focus();
    await page.keyboard.press("Enter");
    const leave = page.getByRole("alertdialog", { name: "Unsaved event changes" });
    await expect(leave.getByRole("button", { name: "Stay" })).toBeFocused();
    await leave.getByRole("button", { name: "Stay" }).click();
    await expect(title).toHaveValue("Synthetic unsaved Edit Event draft");
    await back.click();
    await leave.getByRole("button", { name: "Discard" }).click();
    await expect(page).toHaveURL(new RegExp(recordPath + "$"));
  } finally {
    if (previous.exists) await setting.set(previous.data()!);
    else await setting.delete();
  }
});

test("Event Record rollout keeps scoped navigation and mobile reflow", async ({ page, browser }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Run on desktop and mobile Chromium.");
  test.skip(!password || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080", "Requires the seeded local emulator.");
  const { scheduleFixtureDb } = await import("./support/schedule-fixtures");
  const setting = scheduleFixtureDb().doc("siteSettings/eventRecordExperience");
  const previous = await setting.get();
  const recordPath = "/leader/events/TEST_flow_event_beavers_open";
  try {
    await setting.set({ version: "existing" });
    await loginAsLeader(page, { email: "test.beaver.section.leader@example.com", password: password! });
    await page.goto(recordPath);
    const edit = page.getByRole("link", { name: "Edit Event", exact: true });
    await expect(edit).toBeVisible();
    const resources = page.getByRole("heading", { name: "Programme and resources" });
    await expect(resources).toHaveCount(0);
    if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 800 });

    await setting.set({ version: "redesigned" });
    await expect(resources).toBeVisible();
    await expect(page.getByRole("button", { name: "Hide Event", exact: true })).toHaveCount(0);
    await expect(edit).toHaveAttribute("href", recordPath + "/edit");
    expect((await edit.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    if (testInfo.project.name === "mobile-chromium") {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    }
    await edit.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(recordPath + "/edit$"));
    await page.getByRole("link", { name: "Back to Event", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(recordPath + "$"));
    await expect(resources).toBeVisible();

    const denied = await browser.newContext({ baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:4173" });
    try {
      const deniedPage = await denied.newPage();
      await loginAsLeader(deniedPage, { email: "test.scout.section.leader@example.com", password: password! });
      await deniedPage.goto(recordPath);
      await expect(deniedPage.getByRole("alert").filter({ hasText: /outside your permitted sections|no longer available/ })).toBeVisible();
      await expect(deniedPage.getByRole("link", { name: "Edit Event", exact: true })).toHaveCount(0);
      await deniedPage.goto(recordPath + "/edit");
      await expect(deniedPage.getByRole("alert")).toBeVisible();
      await expect(deniedPage.getByRole("textbox", { name: /Event title/ })).toHaveCount(0);
    } finally {
      await denied.close();
    }
  } finally {
    if (previous.exists) await setting.set(previous.data()!);
    else await setting.delete();
  }
});
