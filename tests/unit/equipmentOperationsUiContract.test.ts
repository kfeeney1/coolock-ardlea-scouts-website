import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const pagePath = new URL("../../src/pages/EquipmentManagement.tsx", import.meta.url);
const reportsPath = new URL("../../src/components/admin/EquipmentReportsPanel.tsx", import.meta.url);
const dashboardPath = new URL("../../src/components/admin/EquipmentOperationsDashboard.tsx", import.meta.url);

describe("equipment operations UI contracts", () => {
  it("places the operational dashboard before the detailed inventory", async () => {
    const source = await readFile(pagePath, "utf8");
    const dashboard = source.indexOf("<EquipmentOperationsDashboard");
    const inventory = source.indexOf('data-testid="equipment-inventory-controls"');
    assert.ok(dashboard >= 0, "Equipment operations dashboard must be rendered for managers");
    assert.ok(inventory > dashboard, "Detailed inventory must follow the high-level dashboard");
    assert.match(source, />Detailed inventory</);
  });

  it("dashboard surfaces stock status and recent checkout, check-in and damage activity", async () => {
    const source = await readFile(dashboardPath, "utf8");
    assert.match(source, /Equipment overview/);
    assert.match(source, /Recent activity/);
    assert.match(source, /Damage reported/);
    assert.match(source, /Checked out/);
    assert.match(source, /Checked in/);
  });

  it("does not prepend a UTF-8 BOM to downloaded equipment CSV files", async () => {
    const source = await readFile(reportsPath, "utf8");
    assert.doesNotMatch(source, /\\uFEFF/);
    assert.match(source, /new Blob\(\[content\]/);
  });
});
