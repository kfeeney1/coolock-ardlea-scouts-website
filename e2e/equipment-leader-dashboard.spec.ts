import { expect, test, type TestInfo } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;

test.describe("Equipment & Stores leader navigation", () => {
  test.skip(!adminEmail || !adminPassword, "Admin E2E credentials are required.");

  test("shows the Leader Dashboard and expandable menu on Android-sized mobile", async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Mobile equipment navigation runs once on the canonical Pixel 7 project.");
    await page.goto("/leader/login");
    await page.getByLabel(/email/i).fill(adminEmail!);
    await page.getByLabel(/password/i).fill(adminPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/leader$/);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

    await page.goto("/leader/equipment");
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();
    const dashboard = page.getByTestId("equipment-operations-dashboard");
    await expect(dashboard.getByText("A high-level view of stock health and the latest operational activity.", { exact: true })).toHaveCount(0);
    await expect(dashboard.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    for (const filter of ["all", "available", "unavailable", "checked-out"]) {
      const tile = dashboard.getByTestId(`equipment-dashboard-${filter}`);
      await expect(tile).toBeVisible();
      const bounds = await tile.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(412);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
    await page.getByRole("button", { name: "Open QM Reports" }).click();
    await expect(page).toHaveURL("/leader/qm-reports");
    await expect(page.getByTestId("page-qm-reports")).toBeVisible();
    const assetRegister = page.getByTestId("export-equipment-asset-register");
    await expect(assetRegister).toBeVisible();
    const assetRegisterBox = await assetRegister.boundingBox();
    expect(assetRegisterBox).not.toBeNull();
    expect(assetRegisterBox!.x).toBeGreaterThanOrEqual(0);
    expect(assetRegisterBox!.x + assetRegisterBox!.width).toBeLessThanOrEqual(412);

    const menu = page.getByRole("button", { name: /Menu · (Equipment|Stores|QM Reports)|Open Leader Menu/i });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
  });
});
