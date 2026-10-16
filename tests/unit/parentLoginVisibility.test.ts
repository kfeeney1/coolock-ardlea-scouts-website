import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PARENT_LOGIN_ENABLED,
  DEFAULT_PARENT_CONSENT_ENABLED,
  normaliseParentConsentEnabled,
  normaliseParentLoginEnabled,
  shouldShowPublicParentLogin,
  shouldShowHeaderParentPortal,
} from "../../src/security/parentLoginVisibility.ts";

test("Parent Login defaults to enabled only when no persisted document exists", () => {
  assert.equal(DEFAULT_PARENT_LOGIN_ENABLED, true);
  assert.equal(normaliseParentLoginEnabled(undefined, false), true);
  assert.equal(normaliseParentLoginEnabled(null, false), true);
  assert.equal(normaliseParentLoginEnabled({}, true), false);
  assert.equal(normaliseParentLoginEnabled({ parentLoginEnabled: false }, true), false);
  assert.equal(normaliseParentLoginEnabled({ parentLoginEnabled: true }, true), true);
});

test("Parent Portal consent flows default to disabled when unset", () => {
  assert.equal(DEFAULT_PARENT_CONSENT_ENABLED, false);
  assert.equal(normaliseParentConsentEnabled(undefined), false);
  assert.equal(normaliseParentConsentEnabled({}), false);
  assert.equal(normaliseParentConsentEnabled({ parentConsentEnabled: false }), false);
  assert.equal(normaliseParentConsentEnabled({ parentConsentEnabled: true }), true);
});

test("public Parent Login stays hidden until settings and authentication state resolve", () => {
  assert.equal(shouldShowPublicParentLogin(null, false, false), false);
  assert.equal(shouldShowPublicParentLogin(true, false, true), false);
  assert.equal(shouldShowPublicParentLogin(false, false, false), false);
  assert.equal(shouldShowPublicParentLogin(true, true, false), false);
  assert.equal(shouldShowPublicParentLogin(true, false, false), true);
});

// The setting controls signed-out entry only; authenticated context navigation
// is determined by route and resolved session state.
test("Header Parent Portal belongs on public/parent routes, never leader routes", () => {
  for (const route of ["/leader", "/leader/", "/leader/settings", "/leader/weekly/meeting-1"]) {
    assert.equal(shouldShowHeaderParentPortal(true, false, route), false, route);
  }
  for (const route of ["/", "/about", "/parent", "/parent/badgework"]) {
    assert.equal(shouldShowHeaderParentPortal(true, false, route), true, route);
    assert.equal(shouldShowHeaderParentPortal(false, false, route), false, route);
    assert.equal(shouldShowHeaderParentPortal(true, true, route), false, route);
  }
});
