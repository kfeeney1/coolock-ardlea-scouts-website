import assert from "node:assert/strict";
import test from "node:test";
import { groupSubsReportAccess } from "../../src/security/groupSubsReportAccess.ts";

test("group Subs oversight can view, and only an active group Treasurer can export", () => {
  assert.deepEqual(groupSubsReportAccess({ role: "super-admin" }), { canOpen: true, canExport: false });
  assert.deepEqual(groupSubsReportAccess({ role: "leader", scoutingRole: "Group Leader" }), { canOpen: true, canExport: false });
  assert.deepEqual(groupSubsReportAccess({ role: "admin" }), { canOpen: false, canExport: false });
  assert.deepEqual(groupSubsReportAccess({ role: "leader", scoutingRole: "Group Treasurer" }), { canOpen: true, canExport: true });
  const treasurer = { appointment: "Group Treasurer", scope: "Group" };
  for (const assignment of [{ ...treasurer, active: false }, { ...treasurer, scope: "Beavers" }]) {
    assert.deepEqual(groupSubsReportAccess({ role: "leader", scoutingRole: "Group Treasurer", appointments: [assignment] }),
      { canOpen: false, canExport: false });
  }
});
