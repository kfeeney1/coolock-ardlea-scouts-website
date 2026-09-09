import assert from "node:assert/strict";
import { test } from "node:test";
import { equipmentImportId, planEquipmentImport } from "../../scripts/equipment-import-core.mjs";

const record = { name: "Patrol Tent", category: "Equipment", trackingMode: "quantity", totalQuantity: 4, location: "Location not recorded", condition: "not-recorded", notes: "", replacementValue: 0, purchaseDate: "", disposalDate: "", replacementValueNote: "", assetRegisterSection: "Equipment", source: "spreadsheet-import", importBatch: "sw-42", importSourceRef: "Equipment:row-3" };

test("equipment import identifiers and plans are deterministic and idempotent", () => {
  const id = equipmentImportId("sw-42", record.importSourceRef);
  assert.equal(id, equipmentImportId("sw-42", record.importSourceRef));
  const first = planEquipmentImport({ batch: "sw-42", records: [record] }, []);
  assert.equal(first.creates.length, 1);
  const second = planEquipmentImport({ batch: "sw-42", records: [record] }, [{ id, ...record }]);
  assert.deepEqual(second.matches, [id]);
  assert.equal(second.creates.length, 0);
});

test("equipment import rejects ambiguous values and duplicate names", () => {
  const invalid = planEquipmentImport({ batch: "sw-42", records: [{ ...record, totalQuantity: "20+" }] }, []);
  assert.deepEqual(invalid.rejected[0].reasons, ["invalid-quantity"]);
  const duplicate = planEquipmentImport({ batch: "sw-42", records: [record] }, [{ id: "manual", name: " patrol  tent " }]);
  assert.equal(duplicate.conflicts[0].reason, "name-conflict");
});
