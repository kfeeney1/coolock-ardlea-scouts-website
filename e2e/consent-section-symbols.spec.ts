import { expect, test } from "@playwright/test";

test.describe("consent access is inside the Parent Portal", () => {
  test("public homepage and navigation hide Parent Login and consent links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Join Us", exact: true }).first()).toBeVisible();
    const width = page.viewportSize()?.width ?? 1280;
    if (width < 900) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await expect(page.getByRole("menuitem", { name: "Leader Login", exact: true })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Parent Login", exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByRole("banner").getByRole("link", { name: "Leader Login", exact: true })).toBeVisible();
      await expect(page.getByRole("banner").getByRole("link", { name: "Parent Login", exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole("link", { name: /consent/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /consent/i })).toHaveCount(0);
  });
});
