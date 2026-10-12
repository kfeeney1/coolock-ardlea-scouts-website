import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Event record navigation runs once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

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
  await loginAdmin(page);
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
  await loginAdmin(page);
  await page.goto("/leader/events/create");
  const title = `TEST event autosave ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByLabel("Start date").fill("2099-05-10");
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
  await loginAdmin(page);
  await page.goto("/leader/events/create");
  const title = `TEST mobile event autosave ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByLabel("Start date").fill("2099-05-11");
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
  await loginAdmin(page);
  await page.goto("/leader/events/TEST_flow_event_beavers_open");

  await page.evaluate(() => {
    window.open = () => null;
  });
  await page.getByRole("button", { name: "Report", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Please allow pop-ups for this site to print the event report." })).toBeVisible();
});


test("Add Event opens the dedicated full-page editor on desktop and mobile", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
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
  await loginAdmin(page);
  await page.goto("/leader/events/create");
  await page.getByLabel("Event title").fill("TEST clear-only event");
  await page.getByLabel("Start date").fill("2099-04-02");
  await page.getByLabel("Location").fill("Temporary location");
  await page.getByLabel("Description").fill("Temporary description");
  await page.getByRole("button", { name: "Clear", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/create$/);
  await expect(page.getByLabel("Event title")).toHaveValue("");
  await expect(page.getByLabel("Start date")).toHaveValue("");
  await expect(page.getByLabel("Location")).toHaveValue("");
  await expect(page.getByLabel("Description")).toHaveValue("");
});

test("future start opens the shared end calendar at a valid date and only applies after confirmation", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/events/create");

  const start = page.getByLabel("Start date");
  const end = page.getByRole("textbox", { name: "End date", exact: true });
  await expect(end).toBeDisabled();
  await start.fill("2099-04-02");
  await expect(end).toBeEnabled();
  await expect(end).toHaveAttribute("data-min-date", "2099-04-02");
  await expect(end).toHaveValue("");
  await page.getByRole("button", { name: "Choose end date" }).click();
  const calendar = page.getByRole("dialog", { name: "Choose end date" });
  await expect(calendar.getByRole("button", { name: "Select 01-04-2099" })).toBeDisabled();
  await expect(calendar.getByRole("button", { name: "Select 02-04-2099" })).toHaveAttribute("aria-pressed", "true");
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
  await expect(page.getByRole("alert")).toContainText("on or after the start date");
  await expect(end).toHaveValue("04-04-2099");

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

test("Back and Cancel avoid empty events and save a valid draft before leaving", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/events/create");
  await page.getByRole("button", { name: "Back to Events", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events$/);

  await page.getByRole("link", { name: "Add Event", exact: true }).click();
  const title = `TEST cancelled event ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByLabel("Start date").fill("2099-04-05");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events$/);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("full-page Create Event preserves fields and audience and saves to the event record", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/events/create");

  const title = `TEST full-page event ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("combobox", { name: "Event type" }).click();
  await page.getByRole("option", { name: "Day Trip", exact: true }).click();
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Beavers", exact: true }).click();
  await page.getByLabel("Start date").fill("2099-05-10");
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
  await expect(page.getByLabel("Start date")).toHaveValue("2099-05-10");
  await expect(page.getByRole("textbox", { name: "End date", exact: true })).toHaveValue("10-05-2099");
  await page.getByLabel("Start date").fill("2099-05-11");
  await expect(page.getByRole("textbox", { name: "End date", exact: true })).toHaveValue("");
  await page.getByRole("textbox", { name: "End date", exact: true }).fill("09-05-2099");
  await page.getByRole("button", { name: "Save Event", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("End date cannot be before the start date");
});

test("direct Create Event route remains protected", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto("/leader/events/create");
  await expect(page).toHaveURL(/\/leader\/login/);
  await expect(page.getByLabel("Email address")).toBeVisible();
});
