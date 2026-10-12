import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Credentials = { email: string; password: string };

function adminCredentials(): Credentials | null {
  const email = process.env.E2E_ADMIN_EMAIL?.trim();
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

async function loginLeader(page: Page, account: Credentials) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  const leaderNavigation = page.waitForURL((url) => url.pathname === "/leader");
  await page.getByRole("button", { name: "Sign In" }).click();
  await leaderNavigation;
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Equipment checkout runs once on desktop Chromium.");
}

test("equipment quantity can be cleared from zero, replaced and persisted", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  const itemName = `TEST Zero Quantity ${testInfo.retry}`;
  await loginLeader(page, account!);
  await page.goto("/leader/equipment");

  await page.getByRole("button", { name: "Add equipment" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await addDialog.getByLabel("Equipment name").fill(itemName);
  await addDialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await addDialog.getByLabel("Store").click();
  await page.getByRole("option", { name: "TEST Checkout Store" }).click();
  const quantity = addDialog.getByTestId("equipment-total-quantity");
  await quantity.fill("0");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();

  const card = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName });
  await expect(card.getByText("0 total", { exact: true })).toBeVisible();
  await card.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/leader\/equipment\/[^/]+$/);
  const summary = page.getByTestId("equipment-record-summary");
  await summary.getByRole("button", { name: "Edit", exact: true }).click();
  const editQuantity = page.getByLabel("Total quantity");
  await expect(editQuantity).toHaveValue("0");
  await editQuantity.fill("");
  await expect(editQuantity).toHaveValue("");
  await editQuantity.fill("5");
  await expect(editQuantity).toHaveValue("5");
  await page.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText("Equipment record saved.", { exact: true })).toBeVisible();
  await expect(page.getByText("5 total", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/equipment$/);
  await expect(page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName }).getByText("5 total", { exact: true })).toBeVisible();
  await page.goto("/leader");
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();
  const reloadedCard = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName });
  await expect(reloadedCard.getByText("5 total", { exact: true })).toBeVisible();
});

test("dashboard tile filters inventory through the URL and browser Back restores the prior view", async ({ page }, testInfo) => {
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  await loginLeader(page, account!);
  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();

  await page.getByRole("button", { name: "Show available in detailed inventory" }).click();
  await expect(page).toHaveURL(/status=available/);
  await expect(page.locator("#equipment-status-filter")).toContainText("Available stock");
  await expect(page.getByRole("button", { name: "Reset filters" })).toBeVisible();

  await page.goBack();
  await expect(page).not.toHaveURL(/status=/);
  await expect(page.locator("#equipment-status-filter")).toContainText("All statuses");
  await expect(page.getByRole("button", { name: "Reset filters" })).toHaveCount(0);

  if (testInfo.project.name === "mobile-chromium") {
    await expect(page.getByTestId("equipment-inventory-controls")).toBeVisible();
    await expect(page.getByLabel("Search equipment")).toBeVisible();
  }
});


test("equipment store filters retain their viewport when applied, changed and cleared", async ({ page }) => {
  const account = adminCredentials();
  test.skip(!account, "Configure canonical E2E admin credentials.");
  await loginLeader(page, account!);
  await page.goto("/leader/equipment");

  const storeFilter = page.getByTestId("equipment-location-filter");
  await storeFilter.scrollIntoViewIfNeeded();
  const initialScroll = await page.evaluate(() => window.scrollY);
  expect(initialScroll).toBeGreaterThan(0);

  const assertStoreFilterVisible = async () => {
    const box = await storeFilter.boundingBox();
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(viewportHeight);
    expect(box!.y + box!.height).toBeGreaterThan(0);
  };

  const selectStore = async (name: string) => {
    await storeFilter.click();
    await page.getByRole("option", { name, exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("store")).toBe(name === "All Stores" ? null : name);
    await assertStoreFilterVisible();
  };

  await storeFilter.click();
  const storeNames = (await page.getByRole("option").allTextContents())
    .map((name) => name.trim())
    .filter((name) => name && name !== "All Stores" && name !== "No Store assigned");
  expect(storeNames.length).toBeGreaterThanOrEqual(2);
  await page.getByRole("option", { name: storeNames[0], exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("store")).toBe(storeNames[0]);
  await assertStoreFilterVisible();

  await selectStore(storeNames[1]);
  await selectStore("All Stores");
  await expect.poll(() => new URL(page.url()).searchParams.has("store")).toBe(false);
  await assertStoreFilterVisible();
});
