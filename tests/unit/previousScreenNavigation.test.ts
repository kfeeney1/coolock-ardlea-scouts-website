import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hasInAppPreviousScreen,
  recordParentRoute
} from "../../src/services/previousScreenNavigation.ts";

test("record routes resolve to their safe direct-entry parent", () => {
  assert.equal(recordParentRoute("/leader/members/member-1"), "/leader/members");
  assert.equal(recordParentRoute("/leader/events/event-1"), "/leader/events");
  assert.equal(recordParentRoute("/leader/join/application-1"), "/leader/join");
  assert.equal(recordParentRoute("/leader/consents/consent-1"), "/leader/consents");
  assert.equal(recordParentRoute("/leader/reports"), null);
});

test("previous-screen navigation requires an in-app browser history entry", () => {
  assert.equal(hasInAppPreviousScreen(null), false);
  assert.equal(hasInAppPreviousScreen({ idx: 0 }), false);
  assert.equal(hasInAppPreviousScreen({ idx: 1 }), true);
  assert.equal(hasInAppPreviousScreen({ idx: 4 }), true);
  assert.equal(hasInAppPreviousScreen({ idx: "1" }), false);
});

test("app installs record Back interception after overlay handling", async () => {
  const source = await readFile("src/App.tsx", "utf8");
  assert.match(source, /<TransientOverlayBackDismissBridge\s*\/>[\s\S]*<RecordBackNavigationBridge\s*\/>/);

  const bridge = await readFile("src/components/RecordBackNavigationBridge.tsx", "utf8");
  assert.match(bridge, /navigate\(-1\)/);
  assert.match(bridge, /addEventListener\("click", handleClick, true\)/);
});

test("record Back interception requires a previous route observed by the current app instance", async () => {
  const bridge = await readFile("src/components/RecordBackNavigationBridge.tsx", "utf8");
  assert.match(bridge, /previousPathRef\s*=\s*useRef<string \| null>\(null\)/);
  assert.match(bridge, /previousPathRef\.current\s*=\s*currentPathRef\.current/);
  assert.match(bridge, /!hasInAppPreviousScreen\(window\.history\.state\)\s*\|\|\s*!previousPathRef\.current/);
});
