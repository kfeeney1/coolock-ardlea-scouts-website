import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/about", "/activities", "/join", "/contact"];

test.describe("public website", () => {
  for (const route of publicRoutes) {
    test(`${route} renders visible content`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.ok()).toBeTruthy();
      await expect(page.locator("body")).not.toBeEmpty();
      await expect(page.locator("body")).toBeVisible();
    });
  }
});

test("leader pages require leader login", async ({ page }) => {
  await page.goto("/leader/events");
  await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();
  await expect(page.getByText("This area is restricted to approved Scout leaders.")).toBeVisible();
});

test("leader login includes password recovery", async ({ page }) => {
  await page.goto("/leader/login");
  await expect(page.getByRole("button", { name: "Forgot Password?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request Leader Access" })).toBeVisible();
});
