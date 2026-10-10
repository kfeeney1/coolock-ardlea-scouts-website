import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("SW-368: menu and overview open the same detailed inventory, preserving URL filters and Back", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL?.trim();
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!email || !password, "Seeded admin credentials required");
  await signIn(page, email!, password!);
  await page.goto("/leader/equipment?view=quartermaster");
  await expect(page.getByTestId("page-qm-equipment-stores")).toBeVisible();
  await page.getByRole("link", { name: "Open Detailed Inventory" }).click();
  await expect(page).toHaveURL(/\/leader\/equipment\/inventory\?view=quartermaster/);
  await expect(page.getByTestId("page-qm-detailed-inventory")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Detailed inventory" })).toBeVisible();
  await page.getByRole("button", { name: /Open Leader Menu|Menu · Detailed Inventory/ }).click();
  await expect(page.getByTestId("leader-nav-qm-detailed-inventory").first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("leader-nav-qm-equipment-stores").first()).not.toHaveAttribute("aria-current", "page");
  await page.goto("/leader/equipment/inventory?view=quartermaster&status=available&category=Camping%20%26%20Sleeping");
  await page.reload();
  await expect(page.getByTestId("page-qm-detailed-inventory")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveText("Available stock");
  await page.getByRole("button", { name: /Open Leader Menu|Menu · Detailed Inventory/ }).click();
  await expect(page.getByTestId("leader-nav-qm-detailed-inventory").first()).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Back to Equipment & Stores" }).click();
  await expect(page).toHaveURL("/leader/equipment?view=quartermaster");
});

test("SW-368: ordinary Scouters cannot access restricted inventory via menu, overview or direct URL", async ({ page }) => {
  const email = process.env.E2E_MULTI_SECTION_LEADER_EMAIL?.trim();
  const password = process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!email || !password, "Seeded ordinary Scouter credentials required");
  await signIn(page, email!, password!);
  await page.goto("/leader/equipment");
  await expect(page.getByRole("link", { name: "Open Detailed Inventory" })).toHaveCount(0);
  await page.goto("/leader/equipment/inventory?view=quartermaster");
  await expect(page.getByRole("alert")).toContainText("do not have permission");
  await expect(page.getByTestId("equipment-inventory-section")).toHaveCount(0);
});
