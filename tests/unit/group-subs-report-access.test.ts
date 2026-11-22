import assert from "node:assert/strict";
import test from "node:test";
import { groupFinanceReportAccess } from "../../src/security/groupFinanceReportAccess.ts";

test("group Subs oversight can view, and only an active group Treasurer can export", () => {
  assert.deepEqual(groupFinanceReportAccess({ role: "super-admin" }), { canOpen: true, canExport: false });
  assert.deepEqual(groupFinanceReportAccess({ role: "leader", scoutingRole: "Group Leader" }), { canOpen: true, canExport: false });
  assert.deepEqual(groupFinanceReportAccess({ role: "admin" }), { canOpen: false, canExport: false });
  assert.deepEqual(groupFinanceReportAccess({ role: "leader", scoutingRole: "Group Treasurer" }), { canOpen: true, canExport: true });
  const treasurer = { appointment: "Group Treasurer", scope: "Group" };
  for (const assignment of [{ ...treasurer, active: false }, { ...treasurer, scope: "Beavers" }]) {
    assert.deepEqual(groupFinanceReportAccess({ role: "leader", scoutingRole: "Group Treasurer", appointments: [assignment] }),
      { canOpen: false, canExport: false });
  }
});
