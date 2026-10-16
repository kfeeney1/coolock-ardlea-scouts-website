import { expect, test, type TestInfo } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { assertEndDatePickerMinimum, assertStartDatePicker } from "./support/end-date-picker-assertions";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Event record navigation runs once on desktop Chromium.");
}

const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

async function persistedAudienceMemberIds(eventId: string): Promise<string[]> {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "demo-coolock-ardlea-scouts";
  const url = new URL(`http://127.0.0.1:8080/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/events/${encodeURIComponent(eventId)}/audienceMembers`);
  // Event audiences allow up to 450 members. Ask for more than that in the
  // emulator REST read so the assertion compares against the complete snapshot.
  url.searchParams.set("pageSize", "1000");
  const response = await fetch(url, { headers: { Authorization: "Bearer owner" } });
  expect(response.ok, "Firestore emulator should return persisted audience rows").toBe(true);
  const data = await response.json() as { documents?: Array<{ name: string }> };
  return (data.documents ?? []).map((document) => document.name.split("/").pop() ?? "").filter(Boolean).sort();
}

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
  await expect(page.getByRole("button", { name: "Report", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeVisible();
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

test("blocked event report pop-ups use in-page error feedback", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/TEST_flow_event_beavers_open");

  await page.evaluate(() => {
    window.open = () => null;
  });
  await page.getByRole("button", { name: "Report", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Please allow pop-ups for this site to print the event report." })).toBeVisible();
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

test("future start opens the shared end calendar at a valid date and only applies after confirmation", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");

  const start = page.getByRole("textbox", { name: /^Start date/ });
  const end = page.getByRole("textbox", { name: "End date", exact: true });
  await expect(start).toHaveAttribute("type", "text");
  await expect(end).toHaveAttribute("type", "text");
  await expect(end).toBeDisabled();
  await expect(page.getByText("Enter a valid start date.", { exact: true })).toBeVisible();
  await start.fill("2099-04-02");
  await expect(end).toBeEnabled();
  await expect(end).toHaveAttribute("data-min-date", "2099-04-02");
  await expect(end).toHaveValue("");
  await page.getByRole("button", { name: "Choose end date" }).click();
  const calendar = page.getByRole("dialog", { name: "Choose end date" });
  await assertEndDatePickerMinimum(calendar, page, "02-04-2099");
  await calendar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(end).toHaveValue("");
  await page.getByRole("button", { name: "Choose end date" }).click();
  const reopenedCalendar = page.getByRole("dialog", { name: "Choose end date" });
  await expect(reopenedCalendar.getByRole("button", { name: "Select 02-04-2099" })).toHaveAttribute("aria-pressed", "true");
  await reopenedCalendar.getByRole("button", { name: "Confirm date" }).click();
  await expect(end).toHaveValue("02-04-2099");

  await end.fill("04-04-2099");
  await expect(end).toHaveValue("04-04-2099");
  await end.blur();

  await start.fill("2099-04-05");
  await expect(end).toHaveValue("");
  await expect(page.getByRole("alert")).toContainText("end date was cleared");

  await end.fill("04-04-2099");
  await expect(end).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("End date cannot be before the start date");
  await expect(end).toHaveValue("04-04-2099");

  await end.fill("31-02-2099");
  await expect(end).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("Enter a real date");
  await start.fill("2099-04-06");
  await expect(end).toHaveValue("31-02-2099");
  await expect(page.getByRole("alert")).toContainText("Enter a real date");
  await start.fill("");
  await expect(start).toHaveAttribute("aria-invalid", "true");
  await expect(end).toBeDisabled();
  await expect(end).toHaveValue("31-02-2099");

  await start.fill("2099-12-31");
  await page.getByRole("button", { name: "Choose end date" }).click();
  const yearBoundaryCalendar = page.getByRole("dialog", { name: "Choose end date" });
  await expect(yearBoundaryCalendar.getByRole("button", { name: "Select 31-12-2099" })).toHaveAttribute("aria-pressed", "true");
  await yearBoundaryCalendar.getByRole("button", { name: "Next month" }).click();
  await expect(yearBoundaryCalendar.getByRole("button", { name: "Select 01-01-2100" })).toBeVisible();
  await yearBoundaryCalendar.getByRole("button", { name: "Select 01-01-2100" }).click();
  await yearBoundaryCalendar.getByRole("button", { name: "Confirm date" }).click();
  await expect(end).toHaveValue("01-01-2100");
});

test("standalone date fields use the same confirmable calendar on mobile and desktop", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");

  const start = page.getByRole("textbox", { name: /^Start date/ });
  await expect(start).toHaveAttribute("type", "text");
  await start.fill("2096-02-28");
  await expect(start).toHaveValue("28-02-2096");
  const calendarTrigger = page.getByRole("button", { name: "Choose start date" });
  await calendarTrigger.click();
  const calendar = page.getByRole("dialog", { name: "Choose start date" });
  await expect(calendar.getByRole("button", { name: "Select 29-02-2096" })).toBeVisible();
  const calendarGrid = calendar.locator('[role="group"]');
  await expect(calendarGrid).toBeVisible();
  await expect(calendarGrid).toHaveAttribute("aria-label", "February 2096 dates");
  await expect(calendar.locator('[aria-label="Mon"]')).toHaveText("Mon");
  await expect(calendar.getByRole("button", { name: "Select 28-02-2096" })).toHaveAttribute("aria-pressed", "true");
  await assertStartDatePicker(calendar, page);
  const bounds = await calendar.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds && viewport && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height).toBe(true);
  await calendar.getByRole("button", { name: "Next month" }).click();
  await expect(calendar.getByRole("button", { name: "Select 28-03-2096" })).toBeVisible();
  await calendar.getByRole("button", { name: "Select 15-03-2096" }).click();
  await expect(calendar.getByText("Selected date: 15-03-2096", { exact: true })).toBeVisible();
  await calendar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(start).toHaveValue("28-02-2096");
  await expect(calendarTrigger).toBeFocused();

  await page.getByRole("button", { name: "Choose start date" }).click();
  const reopened = page.getByRole("dialog", { name: "Choose start date" });
  await expect(reopened.getByRole("button", { name: "Select 28-02-2096" })).toHaveAttribute("aria-pressed", "true");
  const selectedDay = reopened.getByRole("button", { name: "Select 29-02-2096" });
  await selectedDay.focus();
  await expect(selectedDay).toBeFocused();
  await selectedDay.press("ArrowRight");
  await expect(reopened.getByText("March 2096", { exact: true })).toBeVisible();
  await expect(reopened.getByRole("button", { name: "Select 01-03-2096" })).toBeFocused();
  await reopened.getByRole("button", { name: "Previous month" }).click();
  await reopened.getByRole("button", { name: "Select 29-02-2096" }).click();
  await reopened.getByRole("button", { name: "Confirm date" }).click();
  await expect(start).toHaveValue("29-02-2096");
  await expect(start).toHaveAttribute("aria-invalid", "false");

  await start.fill("31-02-2096");
  await expect(start).toHaveAttribute("aria-invalid", "true");
  expect(await start.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(false);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test.describe("date-only calendar in Europe/Dublin", () => {
  test.use({ timezoneId: "Europe/Dublin" });

  test("the daylight-saving boundary remains the same date through the picker", async ({ page }) => {
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAsLeader(page, { email: adminEmail, password: password! });
    await page.goto("/leader/events/create");
    const start = page.getByRole("textbox", { name: /^Start date/ });
    await start.fill("2026-10-25");
    await expect(start).toHaveValue("25-10-2026");
    await page.getByRole("button", { name: "Choose start date" }).click();
    const calendar = page.getByRole("dialog", { name: "Choose start date" });
    await expect(calendar.getByRole("button", { name: "Select 25-10-2026" })).toHaveAttribute("aria-pressed", "true");
    await calendar.getByRole("button", { name: "Confirm date" }).click();
    await expect(start).toHaveValue("25-10-2026");
  });
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
