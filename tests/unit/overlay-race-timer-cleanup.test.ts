import assert from "node:assert/strict";
import { test } from "node:test";
import type { Page } from "@playwright/test";
import { holdOverlayCloseForMenu, holdReopenUntilOverlayCleanup } from "../../e2e/support/overlay-close-race.ts";

for (const [name, install] of [["menu", holdOverlayCloseForMenu], ["reopen", holdReopenUntilOverlayCleanup]] as const) {
  test(`${name} race cleanup preserves pending SDK timers and honours cancellation`, async () => {
    let nextId = 0;
    const pending = new Map<number, { run: () => void; delay: number }>();
    const clock = {
      setTimeout: (run: () => void, delay: number) => { const id = ++nextId; pending.set(id, { run, delay }); return id; },
      clearTimeout: (id?: number) => { if (id !== undefined) pending.delete(id); },
      navigation: new EventTarget()
    };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: clock });
    try {
      const page = {
        evaluate: async (callback: () => unknown) => callback(),
        route: async () => {}, unroute: async () => {}
      } as unknown as Page;
      const gate = await install(page);
      let sdkCalls = 0, cancelledCalls = 0, unrelatedCalls = 0;
      clock.setTimeout(() => { sdkCalls++; }, 500);
      const cancelled = clock.setTimeout(() => { cancelledCalls++; }, 500);
      clock.clearTimeout(cancelled);
      clock.setTimeout(() => { unrelatedCalls++; }, 100);
      assert.equal(sdkCalls, 0, "the requested race is held until cleanup");
      await gate.restore();
      assert.deepEqual([...pending.values()].map(timer => timer.delay).sort((a, b) => a - b), [100, 500]);
      const callbacks = [...pending.values()]; pending.clear();
      for (const timer of callbacks) timer.run();
      assert.equal(sdkCalls, 1, "a pending SDK callback resumes exactly once");
      assert.equal(cancelledCalls, 0, "a cancelled callback stays cancelled");
      assert.equal(unrelatedCalls, 1, "other delays remain untouched");
      await gate.restore();
      assert.equal(pending.size, 0, "repeat cleanup cannot requeue completed callbacks");
    } finally {
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });
}
