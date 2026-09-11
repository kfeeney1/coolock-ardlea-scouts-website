import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");

test("Store, status, category and text filters are applied in the same inventory predicate", () => {
  const start = source.indexOf("const visibleItems = useMemo");
  const end = source.indexOf("const hasActiveFilters", start);
  assert.ok(start >= 0 && end > start);
  const predicate = source.slice(start, end);
  assert.match(predicate, /categoryFilter/);
  assert.match(predicate, /locationFilter/);
  assert.match(predicate, /statusFilter/);
  assert.match(predicate, /search\.trim/);
});
