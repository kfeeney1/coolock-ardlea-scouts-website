import { expect, type Page } from "@playwright/test";

/** A hidden dropdown can still have its asynchronous history POP pending. */
export async function waitForTransientOverlayHistory(page: Page) {
  await expect(page.locator('[role="listbox"]:visible')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const stack = window.history.state?.usr?.__coolockArdleaBackDismissStack;
    return Array.isArray(stack) ? stack.filter((marker: unknown) => typeof marker === "string" && marker.startsWith("transient-overlay:")).length : 0;
  }), { message: "Dropdown history must settle before reload or route navigation" }).toBe(0);
}
