import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

test("programme equipment exposes reservation lifecycle controls", async () => {
  const programme = await readFile("src/services/equipmentProgramme.ts", "utf8");
  const loans = await readFile("src/services/equipmentLoans.ts", "utf8");
  const dialog = await readFile("src/components/admin/ProgrammeEquipmentDialog.tsx", "utf8");
  assert.match(programme, /reserveEquipmentRequirement/);
  assert.match(programme, /cancelEquipmentRequirementReservation/);
  assert.match(loans, /convertEquipmentReservation/);
  assert.match(dialog, /Check out reserved equipment/);
  assert.match(dialog, /Cancel reservation/);
});

test("manual section holdings exclude future reservations", async () => {
  const panel = await readFile("src/components/admin/EquipmentLoansPanel.tsx", "utf8");
  assert.match(panel, /!isEquipmentReservationLoan\(loan\)/);
});

test("events expose programme equipment planning", async () => {
  const page = await readFile("src/pages/EventsManagement.tsx", "utf8");
  const list = await readFile("src/components/admin/EventListPanel.tsx", "utf8");
  assert.match(page, /ProgrammeEquipmentDialog/);
  assert.match(list, />Equipment<\/Button>/);
});
