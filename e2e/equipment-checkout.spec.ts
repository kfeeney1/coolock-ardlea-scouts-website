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
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Equipment checkout runs once on desktop Chromium.");
}

test("admin can add stock, check it out to a section and return it", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  await loginLeader(page, account!);

  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();

  await page.getByRole("button", { name: "Add equipment" }).click();
  await page.getByLabel("Equipment name").fill("TEST Checkout Tent");
  await page.getByLabel("Category").click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await page.getByLabel("Storage location").click();
  await page.getByRole("option", { name: "Other…" }).click();
  await page.getByLabel("New storage location").fill("TEST Checkout Store");
  await page.getByLabel("Total quantity").fill("3");
  await page.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText("TEST Checkout Tent", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Check out equipment" }).click();
  await page.getByLabel("Section").click();
  await page.getByRole("option", { name: "Scouts" }).click();
  const checkoutRow = page.getByText("TEST Checkout Tent", { exact: true }).locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await checkoutRow.getByLabel("Qty").fill("2");
  await page.getByRole("button", { name: "Confirm checkout" }).click();

  await expect(page.getByText("2 × TEST Checkout Tent", { exact: false })).toBeVisible();
  const inventoryCard = page.getByText("TEST Checkout Tent", { exact: true }).last().locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await expect(inventoryCard.getByText("1 available", { exact: true })).toBeVisible();
  await expect(inventoryCard.getByText("2 checked out", { exact: true })).toBeVisible();

  const holdingCard = page.getByText("2 × TEST Checkout Tent", { exact: false }).locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await holdingCard.getByRole("button", { name: "Return equipment" }).click();
  await expect(page.getByRole("dialog").getByText("2 currently checked out")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm return" }).click();

  await expect(page.getByText("No equipment is currently checked out.")).toBeVisible();
  const returnedCard = page.getByText("TEST Checkout Tent", { exact: true }).last().locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await expect(returnedCard.getByText("3 available", { exact: true })).toBeVisible();
});
