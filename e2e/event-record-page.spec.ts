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
  await card.click();

  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);
  await expect(page.getByTestId("event-record-TEST_flow_event_beavers_open")).toBeVisible();
  await expect(page.getByRole("heading", { name: "TEST Beavers Open Day Trip" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attendance", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage Consent", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Record Badgework", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gallery", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Equipment", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Report", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Event", exact: true })).toBeVisible();
});

test("event completion requires explicit confirmation and cancel does not persist it", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/events/TEST_flow_event_beavers_open");

  const record = page.getByTestId("event-record-TEST_flow_event_beavers_open");
  await expect(record.getByText("Open", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit Event", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit Event" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Status").click();
  await page.getByRole("option", { name: "Completed", exact: true }).click();
  await editor.getByRole("button", { name: "Save Event", exact: true }).click();

  const confirmation = page.getByRole("dialog", { name: "Complete this event?" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("TEST Beavers Open Day Trip");
  await expect(confirmation).toContainText("read-only event history");
  await expect(confirmation.getByRole("button", { name: "Complete Event", exact: true })).toBeVisible();

  await confirmation.getByRole("button", { name: "Cancel completion", exact: true }).click();
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(record.getByText("Open", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Event", exact: true })).toBeEnabled();
});
