import { expect, test } from "@playwright/test";

test.describe("consent access is inside the Parent Portal", () => {
  test("public homepage and navigation do not expose consent forms while Parent Login remains available", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Join Us", exact: true }).first()).toBeVisible();
    const parentLoginLink = page.getByRole("link", { name: "Parent Login", exact: true });
    if (await parentLoginLink.count() === 0) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await expect(page.getByRole("menuitem", { name: "Parent Login", exact: true })).toBeVisible();
    } else {
      await expect(parentLoginLink).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /consent/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /consent/i })).toHaveCount(0);
  });
});
