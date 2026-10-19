import assert from "node:assert/strict";
import { test } from "node:test";
import { installOverlayRaceClock } from "../../e2e/support/overlay-race-clock.ts";

for (const [name, control] of [["menu", "overlayMenuRace"], ["reopen", "overlayCloseRace"]] as const) {
  test(`${name} race clock preserves SDK timers and original cancellation handles`, () => {
    let nextId = 0;
    const pending = new Map<number, { run: () => void; delay: number }>();
    const clock = {
      setTimeout: (run: () => void, delay: number) => { const id = ++nextId; pending.set(id, { run, delay }); return id; },
      clearTimeout: (id?: number) => { if (id !== undefined) pending.delete(id); },
      navigation: new EventTarget()
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: clock });
    try {
      installOverlayRaceClock(name);
      const gate = (clock as unknown as Record<string, { count: () => number; restore: () => void }>)[control];
      let sdkCalls = 0, overlayCalls = 0, unrelatedCalls = 0;
      const sdk = clock.setTimeout(() => { sdkCalls++; }, 500);
      assert.equal(gate.count(), 0, "SDK timers must never enter the overlay gate");
      const overlay = clock.setTimeout(Object.assign(() => { overlayCalls++; }, { overlayCloseTimer: true }), 500);
      clock.setTimeout(() => { unrelatedCalls++; }, 100);
      assert.equal(gate.count(), 1);
      gate.restore();
      assert.equal(pending.has(sdk), true, "SDK timer handle survives restore unchanged");
      assert.equal(pending.has(overlay), true, "not-yet-due UI timer retains its cancellable native handle");
      clock.clearTimeout(overlay);
      const callbacks = [...pending.values()]; pending.clear();
      for (const timer of callbacks) timer.run();
      assert.equal(sdkCalls, 1);
      assert.equal(overlayCalls, 0, "cancelling the original UI handle after restore still works");
      assert.equal(unrelatedCalls, 1);
      gate.restore();
      assert.equal(pending.size, 0);
    } finally {
      if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window");
    }
  });

  test(`${name} race flush runs only the captured UI cleanup, never an SDK callback`, () => {
    let nextId = 0;
    const pending = new Map<number, () => void>();
    const clock = { setTimeout: (run: () => void) => { const id = ++nextId; pending.set(id, run); return id; }, clearTimeout: (id?: number) => { if (id !== undefined) pending.delete(id); }, navigation: new EventTarget() };
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: clock });
    try {
      installOverlayRaceClock(name);
      const gate = (clock as unknown as Record<string, { flush?: () => void; count: () => number; restore: () => void }>)[control];
      let sdkCalls = 0, overlayCalls = 0;
      const sdk = (window.setTimeout)(() => { sdkCalls++; }, 500);
      window.setTimeout(Object.assign(() => { overlayCalls++; }, { overlayCloseTimer: true }), 500);
      if (name === "menu") gate.flush!();
      else clock.navigation.dispatchEvent(Object.assign(new Event("navigate"), { navigationType: "push", destination: { url: "http://127.0.0.1:4173/leader/weekly?meeting=record" } }));
      assert.equal(overlayCalls, 1);
      assert.equal(sdkCalls, 0, "a record navigation cannot prematurely execute a transport timer");
      assert.equal(gate.count(), 0);
      clock.clearTimeout(sdk);
      gate.restore();
      assert.equal(pending.size, 0);
    } finally {
      if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window");
    }
  });
}
