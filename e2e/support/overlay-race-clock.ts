/** Browser-serializable timing controls, independent of the Playwright runner. */
export function installReopenRaceClock() {
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
}

export function installMenuRaceClock() {
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
}
