import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Record-page navigation runs once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("Join Us enquiry tiles open full-page records", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/join");

  const card = page.locator('[data-testid^="join-record-"]').first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute("href");
  expect(href).toMatch(/^\/leader\/join\/.+/);
  await expect(card.getByRole("button", { name: "Open enquiry", exact: true })).toBeVisible();
  await card.click();

  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(page.locator('[data-testid^="join-record-page-"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Notes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Contact", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Consent tiles open full-page records", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/consents");

  const card = page.locator('[data-testid^="consent-record-"]').first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute("href");
  expect(href).toMatch(/^\/leader\/consents\/.+/);
  await expect(card.getByRole("button", { name: "Open consent", exact: true })).toBeVisible();
  await card.click();

  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(page.locator('[data-testid^="consent-record-page-"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Print / Save PDF", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
