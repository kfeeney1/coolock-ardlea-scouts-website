import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/components/admin/EquipmentOperationsDashboard.tsx", import.meta.url), "utf8");
const management = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");
const record = fs.readFileSync(new URL("../src/pages/EquipmentRecordPage.tsx", import.meta.url), "utf8");
const categories = fs.readFileSync(new URL("../src/components/admin/EquipmentOptionManager.tsx", import.meta.url), "utf8");
const incidents = fs.readFileSync(new URL("../src/services/equipmentIncidents.ts", import.meta.url), "utf8");
const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

test("SW-138 activity uses stable equipment and issue ids", () => {
  assert.match(dashboard, /itemId: incident\.itemId/);
  assert.match(dashboard, /\/leader\/equipment\/\$\{entry\.itemId\}\?issue=\$\{entry\.incidentId\}/);
  assert.match(record, /highlightedIncidentId=\{highlightedIssueId\}/);
});

test("SW-139 overview lands on the semantic detailed inventory target", () => {
  assert.match(management, /equipment-inventory-section/);
  assert.match(management, /Detailed inventory/);
  assert.match(management, /scrollMarginTop/);
  assert.doesNotMatch(management, /equipment-inventory-controls.*scrollIntoView/);
});

test("SW-140 record actions live inside the summary tile and are distinct", () => {
  assert.match(record, />History<\/Button>/);
  assert.match(record, />Move Store<\/Button>/);
  assert.doesNotMatch(record, /History \/ move Store/);
  assert.doesNotMatch(record, />Back<\/Button>/);
});

test("SW-141 category manager reconciles defaults, saved options and imported values", () => {
  assert.match(categories, /DEFAULT_EQUIPMENT_CATEGORIES/);
  assert.match(categories, /Legacy \/ imported/);
  assert.match(categories, /Built-in/);
  assert.match(categories, /Custom/);
  assert.match(rules, /equipmentCategories[\s\S]*allow update: if canManageEquipment\(\)/);
});

test("SW-142 only reverses stock for incidents that previously adjusted stock", () => {
  const conditional = incidents.indexOf("if (stockAdjusted) {");
  const calculation = incidents.indexOf("const next = resolvedEquipmentQuantities", conditional);
  assert.ok(conditional >= 0 && calculation > conditional);
  assert.match(incidents, /incidentData\.status === "resolved"/);
});
