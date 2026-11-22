import assert from "node:assert/strict";
import test from "node:test";
import { isReportDestination, reportDestinations, reportMenuKeepsItem } from "../../src/navigation/reportDestinations.ts";

test("Report discovery preserves role-specific scope across appointments", () => {
  const reports = reportDestinations({ role: "leader", sections: ["Beavers", "Scouts"], appointments: [
    { appointment: "Group Treasurer", scope: "Group" },
    { appointment: "Section Leader", scope: "Beavers" }
  ] });
  assert.equal(reports.find(row => row.label === "Group Subs Report")?.scope, "All sections");
  assert.equal(reports.find(row => row.label === "Attendance Insights")?.scope, "Beavers");
  assert.equal(reports.find(row => row.label === "Member List Report")?.scope, "Beavers");
  assert.equal(new Set(reports.map(row => row.path)).size, reports.length);
  assert.equal(isReportDestination("/leader/attendance", "?view=matrix", reports), true);
  assert.equal(isReportDestination("/leader/qm-reports", "", reports), false);
  assert.deepEqual(reportDestinations({ role: "leader", scoutingRole: "Scouter", sections: ["Scouts"] }), []);
});

test("Reports rollout removes duplicate menu links while preserving the existing menu", () => {
  for (const id of ["attendance-insights", "qm-reports", "treasurer-reports", "reports-exports"]) {
    assert.equal(reportMenuKeepsItem(id, false), true);
    assert.equal(reportMenuKeepsItem(id, true), false);
  }
  assert.equal(reportMenuKeepsItem("treasurer-subs", true), true);
});
