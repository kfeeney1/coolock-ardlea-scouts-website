import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/components/admin/EquipmentOperationsDashboard.tsx", import.meta.url), "utf8");

test("dashboard tiles are semantic keyboard-accessible buttons", () => {
  assert.match(source, /component="button"/);
  assert.match(source, /type="button"/);
  assert.match(source, /aria-label=/);
  assert.match(source, /&:focus-visible/);
});
