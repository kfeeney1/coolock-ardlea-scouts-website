import assert from "node:assert/strict";
import test from "node:test";
import { canExportMemberSubs, memberSubsExportAccess } from "../../src/security/memberSubsExportAccess.ts";

test("a Section Leader can export an individual ledger in the appointed section", () => {
  const access = memberSubsExportAccess({
    role: "leader", sections: ["Cubs", "Scouts", "Ventures"], appointments: [
      { appointment: "Section Leader", scope: "Cubs" },
      { appointment: "Section Leader", scope: "Scouts", active: false },
      { appointment: "Section Leader", scope: "Ventures", endDate: "2000-01-01" },
      { appointment: "Programme Scouter", scope: "Scouts" },
      { appointment: "Group Leader", scope: "Group" }
    ]
  });
  assert.deepEqual(access, { group: false, sections: ["Cubs"] });
  assert.equal(canExportMemberSubs(access, "Cubs", { section: "Cubs" }), true);
  assert.equal(canExportMemberSubs(access, "Scouts", { section: "Cubs" }), false);
  assert.equal(canExportMemberSubs(access, "Cubs", { section: "Scouts" }), false);
  assert.equal(canExportMemberSubs(access, "Cubs", { section: "Cubs", accountId: "family" }), false);
});

test("the Treasurer retains group exports and a legacy Section Leader retains their assigned sections", () => {
  const treasurer = memberSubsExportAccess({ role: "leader", scoutingRole: "Group Treasurer" });
  assert.equal(canExportMemberSubs(treasurer, "Cubs", { section: "Cubs", accountId: "family" }), true);
  assert.deepEqual(memberSubsExportAccess({ role: "leader", scoutingRole: "Section Leader", sections: ["Cubs"] }).sections, ["Cubs"]);
  assert.deepEqual(memberSubsExportAccess({ role: "leader", scoutingRole: "Scouter", sections: ["Cubs"] }).sections, []);
  assert.deepEqual(memberSubsExportAccess({
    role: "leader", sections: ["Cubs"], appointments: [{ appointment: "Section Leader", scope: "Scouts" }]
  }).sections, []);
});
