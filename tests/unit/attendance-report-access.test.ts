import assert from "node:assert/strict";
import test from "node:test";
import { attendanceReportScope } from "../../src/security/attendanceReportAccess.ts";

test("attendance reports combine eligible appointments within their assigned sections", () => {
  const profile = {
    role: "leader",
    sections: ["Beavers", "Cubs", "Scouts", "Ventures"],
    appointments: [
      { appointment: "Group Treasurer", scope: "Group" },
      { appointment: "Section Leader", scope: "Beavers" },
      { appointment: "Programme Scouter", scope: "Cubs" },
      { appointment: "Scouter", scope: "Scouts" },
      { appointment: "Section Leader", scope: "Ventures", endDate: "2000-01-01" },
      { appointment: "Section Leader", scope: "Rovers" }
    ]
  };
  for (const report of ["named", "aggregate"] as const) {
    assert.deepEqual(attendanceReportScope(profile, report), {
      isAdmin: false, sections: ["Beavers", "Cubs"], allowed: true
    });
    assert.equal(attendanceReportScope({ ...profile, appointments: profile.appointments.slice(0, 1) }, report).allowed, false);
    assert.equal(attendanceReportScope({ role: "leader", scoutingRole: "Scouter", sections: ["Scouts"] }, report).allowed, false);
  }
});

test("group oversight and admin grants distinguish named and aggregate attendance", () => {
  assert.equal(attendanceReportScope({ role: "admin" }, "named").allowed, false);
  assert.equal(attendanceReportScope({ role: "admin" }, "aggregate").isAdmin, true);
  for (const profile of [{ role: "super-admin" }, { role: "leader", scoutingRole: "Group Leader" }]) {
    assert.equal(attendanceReportScope(profile, "named").isAdmin, true);
  }
  assert.equal(attendanceReportScope({ role: "leader", scoutingRole: "Deputy Group Leader" }, "named").allowed, false);
});
