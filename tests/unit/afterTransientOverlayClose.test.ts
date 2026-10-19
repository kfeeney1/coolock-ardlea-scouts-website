import assert from "node:assert/strict";
import test from "node:test";
import { afterTransientOverlayClose } from "../../src/services/afterTransientOverlayClose.ts";

function browser(markers: string[] = []) {
  const events = new EventTarget();
  const timers = new Map<number, () => void>();
  const history = { state: { usr: { __coolockArdleaBackDismissStack: markers, returnTo: "/parent" } } };
  let nextId = 0;
  const target = {
    history,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    setTimeout: (callback: () => void) => { timers.set(++nextId, callback); return nextId; },
    clearTimeout: (id: number) => { timers.delete(id); }
  } as unknown as Window;
  return { target, history, pop: () => events.dispatchEvent(new Event("popstate")), flush: () => {
    for (const [id, callback] of timers) { timers.delete(id); callback(); }
  } };
}

test("child URL commit waits for all transient Back entries and runs exactly once", () => {
  const fixture = browser(["transient-overlay:1", "transient-overlay:2"]);
  let commits = 0;
  afterTransientOverlayClose(() => { commits++; }, fixture.target);
  fixture.flush();
  assert.equal(commits, 0, "closing the popup alone cannot commit a URL");
  fixture.history.state.usr.__coolockArdleaBackDismissStack.pop();
  fixture.pop();
  assert.equal(commits, 0, "a remaining nested entry still owns Back");
  fixture.history.state.usr.__coolockArdleaBackDismissStack.pop();
  fixture.pop();
  assert.equal(commits, 1);
  fixture.pop();
  fixture.flush();
  assert.equal(commits, 1);
  assert.equal(fixture.history.state.usr.returnTo, "/parent");
});

test("route departure or a newer selection cancels a pending child commit", () => {
  const fixture = browser(["transient-overlay:1"]);
  let commits = 0;
  const cancel = afterTransientOverlayClose(() => { commits++; }, fixture.target);
  fixture.flush();
  cancel();
  fixture.history.state.usr.__coolockArdleaBackDismissStack = [];
  fixture.pop();
  assert.equal(commits, 0);
});

test("a selection without an overlay commits after the current event and can be cancelled", () => {
  const fixture = browser();
  let commits = 0;
  const cancel = afterTransientOverlayClose(() => { commits++; }, fixture.target);
  assert.equal(commits, 0);
  cancel();
  fixture.flush();
  assert.equal(commits, 0);
  afterTransientOverlayClose(() => { commits++; }, fixture.target);
  fixture.flush();
  assert.equal(commits, 1);
});

test("null browser state after POP cannot resurrect the consumed React marker", () => {
  const fixture = browser(["transient-overlay:1"]);
  const committed: unknown[] = [];
  afterTransientOverlayClose((state) => { committed.push(state); }, fixture.target);
  fixture.flush();
  assert.deepEqual(committed, []);
  (fixture.history.state as { usr: unknown }).usr = null;
  fixture.pop();
  assert.deepEqual(committed, [null], "the URL replacement must use the cleared browser state");
  fixture.pop();
  assert.deepEqual(committed, [null]);
});
