import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Tile filter audit runs once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("Join Us status tiles filter and jump to enquiry results", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/join");

  const summary = page.getByRole("group", { name: "Join enquiry status summary" });
  const newTile = summary.getByRole("button", { name: /New/ });
  await newTile.click();

  const results = page.getByRole("region", { name: "Join enquiry results" });
  await expect(results).toBeFocused();
  await expect(results).toBeInViewport();
  await expect(newTile).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", { name: "Status" }).first()).toHaveText(/New/);

  const totalTile = summary.getByRole("button", { name: /Total/ });
  await totalTile.click();
  await expect(totalTile).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", { name: "Status" }).first()).toHaveText(/All Statuses/);
});

test("Consent summary tiles filter and jump to consent results", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/consents");

  const summary = page.getByRole("group", { name: "Consent summary filters" });
  const youthTile = summary.getByRole("button", { name: /Youth/ });
  await youthTile.click();

  const results = page.getByRole("region", { name: "Consent results" });
  await expect(results).toBeFocused();
  await expect(results).toBeInViewport();
  await expect(youthTile).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", { name: "Form type" })).toHaveText(/Youth/);

  const medicationTile = summary.getByRole("button", { name: /Medication/ });
  await medicationTile.focus();
  await page.keyboard.press("Enter");
  await expect(medicationTile).toHaveAttribute("aria-pressed", "true");
  await expect(results).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Attention" })).toHaveText(/Medication management/);
});
