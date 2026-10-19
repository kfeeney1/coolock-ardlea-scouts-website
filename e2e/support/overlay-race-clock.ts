/** Browser-serializable timing controls. Only the labelled UI cleanup is gated;
 * Firebase and other SDK timers retain their native timing and cancellation IDs.
 */
export function installOverlayRaceClock(mode: "reopen" | "menu") {
  const originalSet = window.setTimeout.bind(window);
  const originalClear = window.clearTimeout.bind(window);
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;
  if (mode === "reopen" && !navigation) throw Error("The Chromium navigation timing regression requires Navigation API.");
  type Entry = { run: () => void; due: boolean };
  const held = new Map<number, Entry>();
  let holding = true;
  window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay !== 500 || typeof handler !== "function" || !(handler as { overlayCloseTimer?: boolean }).overlayCloseTimer) return originalSet(handler, delay, ...args);
    const entry: Entry = { run: () => handler(...args), due: false };
    const id = originalSet(() => {
      entry.due = true;
      if (!holding) { held.delete(id); entry.run(); }
    }, delay);
    held.set(id, entry);
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = (id?: number) => { if (id !== undefined) held.delete(id); originalClear(id); };
  const flush = () => {
    // Only the captured batch belongs to this race; callbacks can schedule a new owner.
    for (const [id, entry] of [...held]) { held.delete(id); originalClear(id); entry.run(); }
  };
  const flushAtRecordPush = (event: Event) => {
    const entry = event as Event & { navigationType?: string; destination?: { url: string } };
    if (entry.navigationType !== "push" || !entry.destination?.url) return;
    const target = new URL(entry.destination.url);
    if (target.pathname === "/leader/weekly" && target.searchParams.has("meeting")) flush();
  };
  const restore = () => {
    holding = false;
    window.setTimeout = originalSet;
    window.clearTimeout = originalClear;
    navigation?.removeEventListener("navigate", flushAtRecordPush);
    // Not-yet-due callbacks retain their native IDs and remaining delay. Expired
    // UI callbacks resume now; do not re-arm them under unrecognised timer IDs.
    for (const [id, entry] of [...held]) if (entry.due) { held.delete(id); originalClear(id); entry.run(); }
    held.clear();
  };
  const control = window as Window & {
    overlayCloseRace?: { count: () => number; restore: () => void };
    overlayMenuRace?: { count: () => number; flush: () => void; restore: () => void };
  };
  if (mode === "reopen") {
    navigation!.addEventListener("navigate", flushAtRecordPush);
    control.overlayCloseRace = { count: () => held.size, restore };
  } else control.overlayMenuRace = { count: () => held.size, flush, restore };
}
