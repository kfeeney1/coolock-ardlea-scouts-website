import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function mobileOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile Back navigation runs on the Pixel 7 project only.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("mobile Back dismisses the public menu before leaving the current screen", async ({ page }, testInfo) => {
  mobileOnly(testInfo);
  await page.goto("/");

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("menu")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("menu")).toBeHidden();

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.getByRole("menuitem", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("mobile Back closes a select, then its dialog, then returns to the previously seen record list", async ({ page }, testInfo) => {
  mobileOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/events");

  const card = page.getByTestId("event-card-TEST_flow_event_beavers_open");
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);

  await page.getByRole("button", { name: "Edit Event", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit Event" });
  await expect(editor).toBeVisible();

  await editor.getByRole("combobox").first().click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(editor).toBeVisible();
  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);

  await page.goBack();
  await expect(editor).toBeHidden();
  await expect(page.getByTestId("event-record-TEST_flow_event_beavers_open")).toBeVisible();
  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);

  await page.getByRole("button", { name: "Back to Events", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events$/);
  await expect(card).toBeVisible();
});
