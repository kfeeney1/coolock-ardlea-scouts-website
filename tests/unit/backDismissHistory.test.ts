import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BACK_DISMISS_STATE_KEY,
  backDismissStack,
  hasBackDismissMarker,
  isTopBackDismissMarker,
  withBackDismissMarker
} from "../../src/services/backDismissHistory.ts";

test("back-dismiss markers preserve location state and stack in opening order", () => {
  const first = withBackDismissMarker({ source: "meeting" }, "menu");
  const second = withBackDismissMarker(first, "dialog");

  assert.equal(first.source, "meeting");
  assert.deepEqual(backDismissStack(second), ["menu", "dialog"]);
  assert.equal(hasBackDismissMarker(second, "menu"), true);
  assert.equal(isTopBackDismissMarker(second, "menu"), false);
  assert.equal(isTopBackDismissMarker(second, "dialog"), true);
});

test("back-dismiss marker insertion is idempotent and ignores malformed state", () => {
  assert.deepEqual(backDismissStack(null), []);
  assert.deepEqual(backDismissStack({ [BACK_DISMISS_STATE_KEY]: ["menu", 12, null] }), ["menu"]);

  const state = withBackDismissMarker({ [BACK_DISMISS_STATE_KEY]: ["menu"] }, "menu");
  assert.deepEqual(backDismissStack(state), ["menu"]);
});

test("public mobile navigation participates in Back history", async () => {
  const source = await readFile("src/components/Header.tsx", "utf8");
  assert.match(source, /useBackDismiss\(Boolean\(anchorEl\)/);
  assert.match(source, /public-mobile-navigation/);
});
