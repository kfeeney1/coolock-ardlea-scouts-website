import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");

test("Reset filters clears the URL-backed inventory filter state", () => {
  assert.match(source, /const resetFilters = \(\) => setSearchParams\(new URLSearchParams\(\)\)/);
  assert.match(source, /equipment-reset-filters/);
});
