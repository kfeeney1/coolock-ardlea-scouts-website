import { installOverlayRaceClock } from "./overlay-race-clock.ts";
import { expect, type Page } from "@playwright/test";

/** Put the UI-close cleanup at the incoming record navigation, before React's
 * location effects run. Firestore writes are held, then continued unchanged. */
export async function holdReopenUntilOverlayCleanup(page: Page) {
  await page.evaluate(installOverlayRaceClock, "reopen");
  let release!: () => void;
  let writeHeld = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  // Match finite write POSTs, never the long-lived RID=rpc response stream.
  const channel = (url: URL) => url.pathname.endsWith("/google.firestore.v1.Firestore/Write/channel")
    && /^\d+$/.test(url.searchParams.get("RID") || "");
  await page.route(channel, async (route) => {
    const values = new URLSearchParams(route.request().postData() || "");
    if ([...values.values()].some((value) => value.includes("/weeklyMeetings/") && value.includes('"status":{"stringValue":"open"}'))) {
      writeHeld = true;
      await gate;
    }
    await route.continue();
  });
  return {
    ready: async () => {
      await expect.poll(() => writeHeld).toBe(true);
      await expect.poll(() => page.evaluate(() => (window as Window & { overlayCloseRace?: { count: () => number } }).overlayCloseRace?.count() || 0)).toBeGreaterThan(0);
    },
    release,
    restore: async () => {
      release();
      // Keep the released pass-through route until this test's page closes.
      // Removing the final route reconfigures Chromium Fetch interception while
      // Firestore channels are live; the next save can then wait indefinitely.
      // The per-test browser context owns and disposes this handler.
      await page.evaluate(() => (window as Window & { overlayCloseRace?: { restore: () => void } }).overlayCloseRace?.restore());
    }
  };
}

/** Hold a dialog's deferred close until the next overlay owner has committed. */
export async function holdOverlayCloseForMenu(page: Page) {
  await page.evaluate(installOverlayRaceClock, "menu");
  return {
    ready: () => expect.poll(() => page.evaluate(() => (window as Window & { overlayMenuRace?: { count: () => number } }).overlayMenuRace?.count() || 0)).toBeGreaterThan(0),
    flush: async () => {
      await page.evaluate(async () => {
        (window as Window & { overlayMenuRace?: { flush: () => void } }).overlayMenuRace?.flush();
        // Observe the resulting history traversal and rendered menu, not merely
        // the synchronous state before the browser has delivered its POP.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
    },
    restore: () => page.evaluate(() => (window as Window & { overlayMenuRace?: { restore: () => void } }).overlayMenuRace?.restore())
  };
}
