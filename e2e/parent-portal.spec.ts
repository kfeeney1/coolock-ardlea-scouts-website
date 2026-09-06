import { expect, test } from "@playwright/test";

test.describe("Parent Portal", () => {
  test("registration form is available without self-enabling access", async ({ page }) => {
    await page.goto("/parent");
    await page.getByRole("button", { name: "Need an account? Register" }).click();

    await expect(page.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
    await expect(page.getByLabel("Parent / Guardian name")).toBeVisible();
    await expect(page.getByLabel("Mobile number")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Parent Account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enable Parent Access" })).toHaveCount(0);
  });

  test("parent login describes the complete portal and includes forgot password", async ({ page }) => {
    await page.goto("/parent");
    await expect(page.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
    await expect(page.getByText(/Adventure Skills progress, upcoming events and event consent/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Forgot Password?" })).toBeVisible();
    await expect(page.getByText("Parent Consent Portal")).toHaveCount(0);
  });

  test("parent portal remains usable at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/parent");
    await expect(page.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
  });
});
