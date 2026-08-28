import assert from "node:assert/strict";
import test from "node:test";
import {
  availableEquipmentQuantity,
  canUseEquipmentForSection,
  checkoutSectionOptions,
  loanIsComplete,
  outstandingLoanQuantity,
  validateCheckoutQuantity
} from "../../src/services/equipmentLoanLogic.ts";

const leader = {
  role: "leader",
  sections: ["Scouts"],
  scoutingRole: "Section Leader"
};
const quartermaster = { role: "leader", sections: ["Group"], scoutingRole: "Group Quartermaster / Bo'sun" };
const item = {
  name: "4-person Tent",
  totalQuantity: 12,
  checkedOutQuantity: 3,
  archived: false
};

test("availability subtracts checked-out stock without going negative", () => {
  assert.equal(availableEquipmentQuantity(item), 9);
  assert.equal(availableEquipmentQuantity({ totalQuantity: 2, checkedOutQuantity: 5 }), 0);
});

test("ordinary leaders can use equipment only for assigned sections", () => {
  assert.equal(canUseEquipmentForSection(leader, "Scouts"), true);
  assert.equal(canUseEquipmentForSection(leader, "Cubs"), false);
  assert.deepEqual(checkoutSectionOptions(leader), ["Scouts"]);
});

test("quartermaster can issue equipment across the group", () => {
  assert.equal(canUseEquipmentForSection(quartermaster, "Cubs"), true);
  assert.ok(checkoutSectionOptions(quartermaster).includes("Cubs"));
  assert.ok(checkoutSectionOptions(quartermaster).includes("Group"));
});

test("checkout validation prevents over-allocation and archived stock", () => {
  assert.equal(validateCheckoutQuantity(item, 9), null);
  assert.match(validateCheckoutQuantity(item, 10) ?? "", /Only 9/);
  assert.match(validateCheckoutQuantity({ ...item, archived: true }, 1) ?? "", /archived/);
});

test("partial returns keep a loan open until every line is returned", () => {
  const lines = [
    { itemId: "tent", itemName: "Tent", quantity: 4, returnedQuantity: 2 },
    { itemId: "stove", itemName: "Stove", quantity: 2, returnedQuantity: 2 }
  ];
  assert.equal(outstandingLoanQuantity(lines[0]), 2);
  assert.equal(loanIsComplete(lines), false);
  assert.equal(loanIsComplete(lines.map((line) => ({ ...line, returnedQuantity: line.quantity }))), true);
});
