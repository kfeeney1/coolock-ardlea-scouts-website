import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const inventory = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");
const record = fs.readFileSync(new URL("../src/pages/EquipmentRecordPage.tsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../src/services/equipment.ts", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("equipment tiles use stable-id full-page routes and nested actions stop propagation", () => {
  assert.match(inventory, /navigate\(\`\/leader\/equipment\/\$\{item\.id\}\`\)/);
  assert.match(inventory, /e\.stopPropagation\(\)/);
  assert.match(app, /\/leader\/equipment\/:equipmentId/);
  assert.match(record, /loadEquipmentItem\(equipmentId\)/);
});

test("archive lifecycle requires confirmation and supports restoration", () => {
  assert.match(inventory, /Archive .*\?/);
  assert.match(record, /Restore .*\?/);
  assert.match(service, /type: archived \? "item-archived" : "item-restored"/);
  assert.match(service, /action: archived \? "item-archived" : "item-restored"/);
});

test("category and Store management support add rename and safe in-use deletion", () => {
  assert.match(inventory, /updateEquipmentOption\(kind, option, safe\)/);
  assert.match(inventory, /canDeleteEquipmentOption\(option\.name, values\)/);
  assert.match(service, /updated .* equipment record\(s\)/);
});

test("record page exposes issue reporting without manufacturing checkout", () => {
  assert.match(record, /EquipmentIncidentsPanel/);
  assert.match(record, /items=\{\[item\]\}/);
  assert.doesNotMatch(record, /createEquipmentLoan|checkout/i);
});
