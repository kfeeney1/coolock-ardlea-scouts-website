import assert from "node:assert/strict";
import test from "node:test";

import { normalizeThemePreference } from "../../src/theme/themePreferences.ts";

test("theme preference defaults safely without changing functionality", () => {
  assert.equal(normalizeThemePreference(undefined), "default");
  assert.equal(normalizeThemePreference(null), "default");
  assert.equal(normalizeThemePreference("unknown"), "default");
});

test("modern is the only alternate theme currently supported", () => {
  assert.equal(normalizeThemePreference("modern"), "modern");
  assert.equal(normalizeThemePreference("default"), "default");
});
