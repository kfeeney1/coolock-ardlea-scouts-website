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

test("clicking an event tile opens its full record with a clear list action", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/events");

  const card = page.getByTestId("event-card-TEST_flow_event_beavers_open");
  await expect(card).toHaveAttribute("href", "/leader/events/TEST_flow_event_beavers_open");
  await expect(card.getByRole("button", { name: "Open event", exact: true })).toBeVisible();
  await expect(card).toContainText(/\d{2}-\d{2}-\d{4}/);
  await expect(card).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await card.click();

  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);
  const eventRecord = page.getByTestId("event-record-TEST_flow_event_beavers_open");
  await expect(eventRecord).toBeVisible();
  await expect(eventRecord).toContainText(/\d{2}-\d{2}-\d{4}/);
  await expect(eventRecord).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("heading", { name: "TEST Beavers Open Day Trip" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attendance", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage Consent", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Record Badgework", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gallery", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Equipment", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Report", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit Event", exact: true })).toBeVisible();
});

test("event editor saves before navigation, stays on demand, and discards only explicitly", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/events/TEST_flow_event_beavers_open");

  const record = page.getByTestId("event-record-TEST_flow_event_beavers_open");
  await expect(record.getByText("Open", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open\/edit$/);
  await expect(page.getByRole("heading", { name: /Edit event · TEST Beavers Open Day Trip/ })).toBeVisible();
  await page.getByLabel("Event title").fill("Unsaved event title");
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toHaveText("Unsaved changes");
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  const leaveDialog = page.getByRole("dialog", { name: "Save changes before leaving?" });
  await expect(leaveDialog).toBeVisible();
  await page.evaluate(() => window.sessionStorage.removeItem("event-stay-handler"));
  await leaveDialog.getByRole("button", { name: "Stay and keep editing", exact: true }).click();
  const stayDiagnostic = { handler: await page.evaluate(() => window.sessionStorage.getItem("event-stay-handler")), dialogVisible: await leaveDialog.isVisible(), promptOpen: await page.getByTestId("event-unsaved-dialog").getAttribute("data-prompt-open"), navigationKind: await page.getByTestId("event-unsaved-dialog").getAttribute("data-navigation-kind"), url: page.url() };
  await expect(leaveDialog).toBeHidden({ timeout: 1500 });
  expect(stayDiagnostic.handler, JSON.stringify(stayDiagnostic)).toBe("called");
  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open\/edit$/);
  await expect(page.getByLabel("Event title")).toHaveValue("Unsaved event title");
  const backToEvent = page.locator('a[href="/leader/events/TEST_flow_event_beavers_open"]');
  await expect(backToEvent).toBeVisible();
  await backToEvent.click();
  await leaveDialog.getByRole("button", { name: "Discard and leave", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);
  await expect(page.getByRole("heading", { name: "TEST Beavers Open Day Trip" })).toBeVisible();
  await expect(page.getByText("Unsaved event title")).toHaveCount(0);
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
  await page.getByRole("button", { name: "Add Event", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/create$/);
  await expect(page.getByTestId("event-create-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create Event" })).toBeVisible();
  await expect(page.getByTestId("event-editor-dialog")).toHaveCount(0);
  await expect(page.getByLabel("Event title")).toBeVisible();
  await expect(page.getByText("Invited audience", { exact: true })).toBeVisible();
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

test("Back and Cancel return to Events without persisting a new event", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/events/create");
  await page.getByRole("button", { name: "Back to Events", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events$/);

  await page.getByRole("button", { name: "Add Event", exact: true }).click();
  const title = `TEST cancelled event ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByLabel("Start date").fill("2099-04-05");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  const discard = page.getByRole("dialog", { name: "Discard this new event?" });
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Event title")).toHaveValue(title);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("dialog", { name: "Discard this new event?" }).getByRole("button", { name: "Discard and cancel" }).click();

  await expect(page).toHaveURL(/\/leader\/events$/);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

test("full-page Create Event preserves fields and audience and saves to the event record", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/events/create");

  const title = `TEST full-page event ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  const beaversAudienceSection = page.getByRole("checkbox", { name: /Beavers \(\d+\)/ });
  await expect(beaversAudienceSection).toBeChecked();
  await page.getByRole("combobox", { name: "Event type" }).click();
  await page.getByRole("option", { name: "Day Trip", exact: true }).click();
  await page.getByRole("combobox", { name: "Event section" }).click();
  await page.getByRole("option", { name: "Beavers", exact: true }).click();
  await page.getByLabel("Start date").fill("2099-05-10");
  await page.getByLabel("End date").fill("2099-05-10");
  await page.getByLabel("Location").fill("TEST full-page location");
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Open", exact: true }).click();
  await page.getByLabel("Event consent required").check();
  await page.getByLabel("Meeting / departure details").fill("TEST departure");
  await page.getByLabel("Return / collection details").fill("TEST return");
  await page.getByLabel("Description").fill("TEST event description");
  await page.getByLabel("Leader notes").fill("TEST leader notes");

  await expect(page.getByTestId("event-audience-builder")).toContainText("Event section: Beavers");
  await expect(beaversAudienceSection).toBeChecked();
  await page.getByRole("button", { name: "Selected members", exact: true }).click();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await page.getByRole("button", { name: "Beavers", exact: true }).click();
  await page.getByRole("checkbox").first().check();
  await expect(page.getByTestId("event-audience-summary")).toContainText("selected member");
  await page.getByRole("button", { name: "Create Event", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/[^/]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("TEST full-page location", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Save changes before leaving?" })).toHaveCount(0);
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const updatedTitle = `${title} updated`;
  await page.getByLabel("Event title").fill(updatedTitle);
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toHaveText("Unsaved changes");
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  const leaveDialog = page.getByRole("dialog", { name: "Save changes before leaving?" });
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Save and leave", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events\/[a-zA-Z0-9_-]+$/);
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await expect(page.getByText("1 invited", { exact: true })).toBeVisible();
});

test("direct Create Event route remains protected", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto("/leader/events/create");
  await expect(page).toHaveURL(/\/leader\/login/);
  await expect(page.getByLabel("Email address")).toBeVisible();
});
