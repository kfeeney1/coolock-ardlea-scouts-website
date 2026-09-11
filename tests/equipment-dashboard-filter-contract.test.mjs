import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const management = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../src/components/admin/EquipmentOperationsDashboard.tsx", import.meta.url), "utf8");

test("equipment inventory uses one URL-backed Store/status filter model", () => {
  assert.match(management, /useSearchParams/);
  assert.match(management, /searchParams\.get\("store"\)/);
  assert.match(management, /searchParams\.get\("status"\)/);
  assert.match(management, /All Stores/);
  assert.match(management, /No Store assigned/);
  assert.match(management, /availableEquipmentQuantity\(item\) <= 0/);
  assert.match(management, /item\.checkedOutQuantity <= 0/);
  assert.match(management, /item\.unavailableQuantity <= 0/);
});

test("equipment dashboard tiles navigate through semantic inventory filters", () => {
  assert.match(dashboard, /component="button"/);
  assert.match(dashboard, /aria-label=\{`Show \$\{label\.toLowerCase\(\)\} in detailed inventory`\}/);
  assert.match(dashboard, /"available"/);
  assert.match(dashboard, /"checked-out"/);
  assert.match(dashboard, /"unavailable"/);
  assert.match(management, /onFilterInventory=\{showInventoryFilter\}/);
  assert.match(management, /setSearchParams\(next\)/);
});

test("Store UX reuses the existing equipment location architecture", () => {
  assert.match(management, /loadEquipmentOptions\("locations"\)/);
  assert.match(management, /addEquipmentOption\("locations", safe\)/);
  assert.match(management, /Manage Stores/);
  assert.match(management, /History \/ move Store/);
  assert.doesNotMatch(management, /equipmentStores/);
});
