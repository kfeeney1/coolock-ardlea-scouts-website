import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("Equipment & Stores leader navigation", () => {
  test.skip(!adminEmail || !adminPassword, "Admin E2E credentials are required.");

  test("shows the Leader Dashboard and expandable menu on Android-sized mobile", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/leader/login");
    await page.getByLabel(/email/i).fill(adminEmail!);
    await page.getByLabel(/password/i).fill(adminPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/leader/);

    await page.goto("/leader/equipment");
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();

    const menu = page.getByRole("button", { name: /Menu · Equipment & Stores|Open Leader Menu/i });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole("button", { name: "Weekly Meetings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
  });
});
