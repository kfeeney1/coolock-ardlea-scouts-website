import assert from "node:assert/strict";
import test from "node:test";

import { normalizeThemePreference, THEME_OPTIONS } from "../../src/theme/themePreferences.ts";

test("theme preference defaults safely without changing functionality", () => {
  assert.equal(normalizeThemePreference(undefined), "default");
  assert.equal(normalizeThemePreference(null), "default");
  assert.equal(normalizeThemePreference("unknown"), "default");
});

test("offers exactly three new review options while retaining current themes", () => {
  assert.equal(THEME_OPTIONS.filter((option) => option.isNew).length, 3);
  assert.deepEqual(THEME_OPTIONS.slice(0, 2).map((option) => option.name), ["default", "modern"]);
});

test("all review themes are supported", () => {
  assert.equal(normalizeThemePreference("modern"), "modern");
  assert.equal(normalizeThemePreference("irish-adventure"), "irish-adventure");
  assert.equal(normalizeThemePreference("uk-campaign"), "uk-campaign");
  assert.equal(normalizeThemePreference("programme-led"), "programme-led");
  assert.equal(normalizeThemePreference("default"), "default");
});
