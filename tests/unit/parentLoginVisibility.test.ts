import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PARENT_LOGIN_ENABLED,
  normaliseParentLoginEnabled,
  shouldShowPublicParentLogin,
} from "../../src/security/parentLoginVisibility.ts";

test("Parent Login defaults to enabled only when no persisted document exists", () => {
  assert.equal(DEFAULT_PARENT_LOGIN_ENABLED, true);
  assert.equal(normaliseParentLoginEnabled(undefined, false), true);
  assert.equal(normaliseParentLoginEnabled(null, false), true);
  assert.equal(normaliseParentLoginEnabled({}, true), false);
  assert.equal(normaliseParentLoginEnabled({ parentLoginEnabled: false }, true), false);
  assert.equal(normaliseParentLoginEnabled({ parentLoginEnabled: true }, true), true);
});

test("public Parent Login stays hidden until settings and authentication state resolve", () => {
  assert.equal(shouldShowPublicParentLogin(null, false, false), false);
  assert.equal(shouldShowPublicParentLogin(true, false, true), false);
  assert.equal(shouldShowPublicParentLogin(false, false, false), false);
  assert.equal(shouldShowPublicParentLogin(true, true, false), false);
  assert.equal(shouldShowPublicParentLogin(true, false, false), true);
});
