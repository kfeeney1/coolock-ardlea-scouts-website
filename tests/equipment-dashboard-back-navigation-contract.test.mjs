import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");

test("dashboard filter navigation pushes URL history rather than replacing it", () => {
  const start = source.indexOf("const showInventoryFilter");
  const end = source.indexOf("const openCreate", start);
  assert.ok(start >= 0 && end > start);
  const implementation = source.slice(start, end);
  assert.match(implementation, /setSearchParams\(next\)/);
  assert.doesNotMatch(implementation, /replace:\s*true/);
});
