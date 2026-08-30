import { expect, test } from "@playwright/test";

test.describe("Stable loading shell", () => {
  test("keeps the public header mounted while a lazy route loads", async ({ page }) => {
    await page.goto("/");

    const brandLogo = page.getByRole("img", { name: "80th 160th Coolock Ardlea Scout Group" });
    await expect(brandLogo).toBeVisible();

    await page.evaluate(() => {
      const selector = 'img[alt="80th 160th Coolock Ardlea Scout Group"]';
      (window as Window & { __shellWasRemoved?: boolean }).__shellWasRemoved = false;
      const observer = new MutationObserver(() => {
        if (!document.querySelector(selector)) {
          (window as Window & { __shellWasRemoved?: boolean }).__shellWasRemoved = true;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      (window as Window & { __shellObserver?: MutationObserver }).__shellObserver = observer;
    });

    // The mobile Chromium project hides desktop navigation links behind the menu.
    // Open the real mobile navigation and follow the About route through React Router
    // so this regression test still observes the shell during an in-app lazy transition.
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("menuitem", { name: "About", exact: true }).click();

    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole("heading", { name: "About Us" })).toBeVisible();
    await expect(brandLogo).toBeVisible();

    const shellWasRemoved = await page.evaluate(() => {
      const state = window as Window & { __shellWasRemoved?: boolean; __shellObserver?: MutationObserver };
      state.__shellObserver?.disconnect();
      return state.__shellWasRemoved ?? false;
    });
    expect(shellWasRemoved).toBe(false);
  });
});
