import assert from "node:assert/strict";
import test from "node:test";
import { meetingReportAccess } from "../../src/security/meetingReportAccess.ts";

test("meeting report access grants group oversight and intersects section appointments", () => {
  for (const profile of [{ role: "super-admin" }, { role: "leader", scoutingRole: "Group Secretary" }, { role: "leader", scoutingRole: "Group Leader" }]) {
    assert.equal(meetingReportAccess(profile).group, true);
  }
  assert.deepEqual(meetingReportAccess({
    role: "leader", sections: ["Beavers", "Cubs"],
    appointments: [
      { appointment: "Section Leader", scope: "Beavers" },
      { appointment: "Group Secretary", scope: "Group", active: false },
      { appointment: "Programme Scouter", scope: "Cubs" }
    ]
  }), { group: false, sections: ["Beavers"], canOpen: true });
  for (const profile of [{ role: "admin" }, { role: "leader", scoutingRole: "Group Chairperson" }, { role: "leader", scoutingRole: "Deputy Group Leader" }]) {
    assert.equal(meetingReportAccess(profile).canOpen, false);
  }
});
