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
  const eventPath = new URL(eventUrl).pathname;
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/edit$`));
  await expect(page.getByRole("heading", { name: new RegExp(`Edit event · ${title}`) })).toBeVisible();
  await page.getByLabel("Event title").fill("");
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/edit$`));
  await expect(page.getByRole("alert").filter({ hasText: "Event title and start date are required" })).toBeVisible();
  const updatedTitle = `${title} updated`;
  await page.getByLabel("Event title").fill(updatedTitle);
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();

  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const browserBackTitle = `${updatedTitle} browser back`;
  await page.getByLabel("Event title").fill(browserBackTitle);
  await page.goBack();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: browserBackTitle })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: browserBackTitle })).toBeVisible();
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
  await page.getByRole("button", { name: "Add Event", exact: true }).click();

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

test("Back and Cancel avoid empty events and save a valid draft before leaving", async ({ page }) => {
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
  await page.getByLabel("End date").fill("2099-05-10");
  await page.getByLabel("Location").fill("TEST full-page location");
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Open", exact: true }).click();
  await page.getByLabel("Event consent required").check();
  await page.getByLabel("Meeting / departure details").fill("TEST departure");
  await page.getByLabel("Return / collection details").fill("TEST return");
  await page.getByLabel("Description").fill("TEST event description");
  await page.getByLabel("Leader notes").fill("TEST leader notes");

  await expect(page.getByText(/Audience: .*Beavers/)).toBeVisible();
  await page.getByRole("button", { name: "Create Event", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/[^/]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("TEST full-page location", { exact: true })).toBeVisible();
});

test("selected-member event audience stays exact across sections, edit, save and reload on desktop and mobile", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Selected-member event targeting runs on desktop Chromium and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/events/create");

  const title = `TEST selected audience ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByLabel("Start date").fill("2099-06-10");
  await page.getByRole("button", { name: "Selected members", exact: true }).click();
  await page.getByRole("button", { name: "Clear all members", exact: true }).click();
  await page.getByRole("button", { name: "Add other group members", exact: true }).click();
  await page.getByLabel("Search authorized group members").fill("TEST");

  const selectedCub = page.getByRole("checkbox", { name: /· Cubs$/ }).first();
  const selectedScout = page.getByRole("checkbox", { name: /· Scouts$/ }).first();
  await expect(selectedCub).toBeVisible();
  await expect(selectedScout).toBeVisible();
  await selectedCub.check();
  await selectedScout.check();
  await expect(page.getByTestId("event-audience-summary")).toContainText("Audience: 2 selected members");
  await expect(page.getByText("Only the members selected here will be invited")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Create Event", exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator('[data-testid^="event-record-"]').filter({ hasText: title })).toContainText("2 invited");
  await expect(page.getByTestId("event-record-audience")).toContainText("Audience: 2 selected members");

  const eventUrl = page.url();
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await expect(page.getByTestId("event-audience-summary")).toContainText("Audience: 2 selected members");
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Ventures", exact: true }).click();
  await page.getByRole("button", { name: "Save Event", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByTestId("event-record-audience")).toContainText("Audience: 2 selected members");
  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByTestId("event-record-audience")).toContainText("Audience: 2 selected members");
});

test("direct Create Event route remains protected", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto("/leader/events/create");
  await expect(page).toHaveURL(/\/leader\/login/);
  await expect(page.getByLabel("Email address")).toBeVisible();
});
