import { expect, test } from "@playwright/test";

test.describe("Parent Portal", () => {
  test("registration collects minimal child identity and supports multiple children without self-enabling access", async ({ page }) => {
    await page.goto("/parent");
    await page.getByRole("button", { name: "Need an account? Register" }).click();

    await expect(page.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
    await expect(page.getByLabel("Parent / Guardian name")).toBeVisible();
    await expect(page.getByLabel("Mobile number")).toBeVisible();
    await expect(page.getByLabel("Child 1 first name")).toBeVisible();
    await expect(page.getByLabel("Child 1 surname")).toBeVisible();
    await expect(page.getByLabel("Child 1 date of birth")).toBeVisible();
    await expect(page.getByText(/never grant access automatically/i)).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Parent Account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enable Parent Access" })).toHaveCount(0);

    await page.getByRole("button", { name: "Add another child" }).click();
    await expect(page.getByLabel("Child 2 first name")).toBeVisible();
    await expect(page.getByLabel("Child 2 surname")).toBeVisible();
    await expect(page.getByLabel("Child 2 date of birth")).toBeVisible();
    await page.getByRole("button", { name: "Remove Child 2" }).click();
    await expect(page.getByLabel("Child 2 first name")).toHaveCount(0);
  });

  test("registration never exposes a searchable member database or candidate result", async ({ page }) => {
    await page.goto("/parent");
    await page.getByRole("button", { name: "Need an account? Register" }).click();
    await expect(page.getByPlaceholder(/search members/i)).toHaveCount(0);
    await expect(page.getByText(/likely existing member/i)).toHaveCount(0);
    await expect(page.getByText(/matched/i)).toHaveCount(0);
  });

  test("parent login describes the complete portal and includes forgot password", async ({ page }) => {
    await page.goto("/parent");
    await expect(page.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
    await expect(page.getByText(/Adventure Skills progress, upcoming events and event consent/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Forgot Password?" })).toBeVisible();
    await expect(page.getByText("Parent Consent Portal")).toHaveCount(0);
  });

  test("parent registration remains usable at mobile width and browser Back remains normal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/about");
    await page.goto("/parent");
    await page.getByRole("button", { name: "Need an account? Register" }).click();
    await expect(page.getByLabel("Child 1 first name")).toBeVisible();
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
    await page.goBack();
    await expect(page).toHaveURL(/\/about$/);
  });
});
