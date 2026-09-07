import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const BACK_RESPONSE_TIMEOUT_MS = 1000;

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

async function viewportState(page: Page) {
  return page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    clientWidth: document.documentElement.clientWidth
  }));
}

test("mobile Back dismisses the public menu promptly before leaving the current screen", async ({ page }, testInfo) => {
  mobileOnly(testInfo);
  await page.goto("/");

  const beforeMenu = await viewportState(page);
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect.poll(() => viewportState(page)).toEqual(beforeMenu);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("menu")).toBeHidden({ timeout: BACK_RESPONSE_TIMEOUT_MS });

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.getByRole("menuitem", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("mobile Back promptly closes a select, then its dialog, then returns to the previously seen record list", async ({ page }, testInfo) => {
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
  await expect(page.getByRole("listbox")).toBeHidden({ timeout: BACK_RESPONSE_TIMEOUT_MS });
  await expect(editor).toBeVisible();
  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);

  await page.goBack();
  await expect(editor).toBeHidden({ timeout: BACK_RESPONSE_TIMEOUT_MS });
  await expect(page.getByTestId("event-record-TEST_flow_event_beavers_open")).toBeVisible();
  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/events$/);
  await expect(card).toBeVisible();
});

test("mobile application Back ignores stale history indexes after direct record entry", async ({ page }, testInfo) => {
  mobileOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);

  await page.goto("/leader/events/TEST_flow_event_beavers_open");
  await expect(page.getByTestId("event-record-TEST_flow_event_beavers_open")).toBeVisible();

  await page.evaluate(() => {
    const state = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
    window.history.replaceState({ ...state, idx: 3 }, "", window.location.href);
  });

  await page.getByRole("button", { name: "Back to Events", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events$/);
  await expect(page.getByTestId("event-card-TEST_flow_event_beavers_open")).toBeVisible();
});
