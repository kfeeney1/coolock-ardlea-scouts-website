import assert from "node:assert/strict";
import test from "node:test";
import { membershipTotalsAccess } from "../../src/security/membershipTotalsAccess.ts";

test("membership totals grants approved group roles and intersects assigned sections", () => {
  for (const profile of [{ role: "admin" }, { role: "super-admin" }, { role: "leader", scoutingRole: "Group Secretary" }, { role: "leader", scoutingRole: "Group Leader" }]) {
    assert.equal(membershipTotalsAccess(profile).group, true);
  }
  assert.deepEqual(membershipTotalsAccess({
    role: "leader", sections: ["Beavers", "Cubs"], appointments: [
      { appointment: "Section Leader", scope: "Beavers" },
      { appointment: "Group Treasurer", scope: "Group" },
      { appointment: "Section Leader", scope: "Cubs", active: false }
    ]
  }), { group: false, sections: ["Beavers"], canOpen: true });
  assert.equal(membershipTotalsAccess({ role: "leader", scoutingRole: "Group Chairperson" }).canOpen, false);
});
