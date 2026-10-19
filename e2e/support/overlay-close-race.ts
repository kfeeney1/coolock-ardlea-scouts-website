import { expect, type Page } from "@playwright/test";

/** Put the UI-close cleanup at the incoming record navigation, before React's
 * location effects run. Firestore writes are held, then continued unchanged. */
export async function holdReopenUntilOverlayCleanup(page: Page) {
  await page.evaluate(() => {
    const originalSet = window.setTimeout.bind(window);
    const originalClear = window.clearTimeout.bind(window);
    const held = new Map<number, () => void>();
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay !== 500 || typeof handler !== "function") return originalSet(handler, delay, ...args);
      const id = originalSet(() => undefined, 60_000);
      held.set(id, () => handler(...args));
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = (id?: number) => { if (id !== undefined) held.delete(id); originalClear(id); };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    if (!navigation) throw Error("The Chromium navigation timing regression requires Navigation API.");
    const flushAtRecordPush = (event: Event) => {
      const entry = event as Event & { navigationType?: string; destination?: { url: string } };
      if (entry.navigationType !== "push" || !entry.destination?.url) return;
      const target = new URL(entry.destination.url);
      if (target.pathname !== "/leader/weekly" || !target.searchParams.has("meeting")) return;
      for (const [id, run] of held) { held.delete(id); originalClear(id); run(); }
    };
    navigation.addEventListener("navigate", flushAtRecordPush);
    const control = window as Window & { overlayCloseRace?: { count: () => number; restore: () => void } };
    control.overlayCloseRace = {
      count: () => held.size,
      restore: () => {
        // The delay gate can also capture SDK timers. Restore must not
        // discard live callbacks and strand Firestore's next write/read.
        window.setTimeout = originalSet;
        window.clearTimeout = originalClear;
        for (const [id, run] of held) { originalClear(id); originalSet(run, 500); }
        held.clear();
        navigation.removeEventListener("navigate", flushAtRecordPush);
        window.setTimeout = originalSet;
        window.clearTimeout = originalClear;
      }
    };
  });
  let release!: () => void;
  let writeHeld = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const channel = "**/google.firestore.v1.Firestore/Write/channel?**";
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
      await page.unroute(channel);
      await page.evaluate(() => (window as Window & { overlayCloseRace?: { restore: () => void } }).overlayCloseRace?.restore());
    }
  };
}

/** Hold a dialog's deferred close until the next overlay owner has committed. */
export async function holdOverlayCloseForMenu(page: Page) {
  await page.evaluate(() => {
    const originalSet = window.setTimeout.bind(window);
    const originalClear = window.clearTimeout.bind(window);
    const held = new Map<number, () => void>();
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay !== 500 || typeof handler !== "function") return originalSet(handler, delay, ...args);
      const id = originalSet(() => undefined, 60_000);
      held.set(id, () => handler(...args));
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = (id?: number) => { if (id !== undefined) held.delete(id); originalClear(id); };
    const control = window as Window & { overlayMenuRace?: { count: () => number; flush: () => void; restore: () => void } };
    control.overlayMenuRace = {
      count: () => held.size,
      flush: () => { for (const [id, run] of held) { held.delete(id); originalClear(id); run(); } },
      restore: () => {
        // The delay gate can also capture SDK timers. Restore must not
        // discard live callbacks and strand Firestore's next write/read.
        window.setTimeout = originalSet;
        window.clearTimeout = originalClear;
        for (const [id, run] of held) { originalClear(id); originalSet(run, 500); }
        held.clear();
        window.setTimeout = originalSet;
        window.clearTimeout = originalClear;
      }
    };
  });
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
