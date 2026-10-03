import assert from "node:assert/strict";
import test from "node:test";

import { filterMemberRecords } from "../../src/services/memberManagementLogic.ts";
import { filterMembersBySectionRole, normalizeMemberSectionRoles, setMemberSectionRole } from "../../src/services/memberYouthRoles.ts";

const members = [
  { id: "beaver-active", displayName: "Active Beaver", firstName: "Active", lastName: "Beaver", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", section: "Beavers", status: "active" as const },
  { id: "cub-active", displayName: "Active Cub", firstName: "Active", lastName: "Cub", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", section: "Cubs", status: "active" as const },
  { id: "venture-new", displayName: "New Venture", firstName: "New", lastName: "Venture", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", section: "Venture Scout", status: "active" as const },
  { id: "venture-existing", displayName: "Existing Venture", firstName: "Existing", lastName: "Venture", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", section: "Ventures", status: "inactive" as const },
  { id: "scout-existing", displayName: "Existing Scout", firstName: "Existing", lastName: "Scout", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", section: "Scouts", status: "active" as const },
  { id: "venture-left", displayName: "Former Venture", firstName: "Former", lastName: "Venture", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", section: "Ventures", status: "left" as const }
];

test("Member Management section filters include canonical and legacy Venture records", () => {
  assert.deepEqual(filterMemberRecords(members, "Ventures", "all").map((member) => member.id), [
    "venture-existing", "venture-left", "venture-new"
  ]);
  assert.deepEqual(filterMemberRecords(members, "all", "all").map((member) => member.id), ["beaver-active", "cub-active", "scout-existing", "venture-existing", "venture-left", "venture-new"]);
});

test("Member Management status filters include only the requested lifecycle state", () => {
  assert.deepEqual(filterMemberRecords(members, "Ventures", "active").map((member) => member.id), ["venture-new"]);
  assert.deepEqual(filterMemberRecords(members, "all", "inactive").map((member) => member.id), ["venture-existing"]);
  assert.deepEqual(filterMemberRecords(members, "all", "left").map((member) => member.id), ["venture-left"]);
  assert.equal(filterMemberRecords(members, "all", "all", "new venture").length, 1);
});

test("SW-218 active members remain visible in their applicable section and All Sections", () => {
  for (const [section, id] of [["Beavers", "beaver-active"], ["Cubs", "cub-active"], ["Scouts", "scout-existing"], ["Ventures", "venture-new"]] as const) {
    assert.ok(filterMemberRecords(members, section, "active").some((member) => member.id === id), `${section} should include ${id}`);
    assert.ok(filterMemberRecords(members, "all", "active").some((member) => member.id === id), `All Sections should include ${id}`);
  }
  assert.equal(filterMemberRecords(members, "Scouts", "active").some((member) => member.id === "venture-new"), false);
});

test("member lists sort by trimmed surname then first name using Irish locale rules", () => {
  const mixed = [
    { ...members[0], id: "m1", firstName: "Cara", lastName: " Murphy " },
    { ...members[0], id: "m2", firstName: "Zoe", lastName: "Byrne" },
    { ...members[0], id: "m3", firstName: "Amy", lastName: "BYRNE" },
    { ...members[0], id: "m4", firstName: "Aisling", lastName: "O’Neill-Smith" },
    { ...members[0], id: "m5", firstName: "Eoin", lastName: "Ó Súilleabháin" },
    { ...members[0], id: "m6", firstName: "Bláithín", lastName: "Ní Bhraonáin" },
    { ...members[0], id: "m7", firstName: "Zed", lastName: "  " },
    { ...members[0], id: "m8", firstName: "Alex", lastName: "" }
  ];
  const result = filterMemberRecords(mixed, "all", "all");
  assert.deepEqual(result.map((member) => member.firstName), ["Amy", "Zoe", "Cara", "Bláithín", "Eoin", "Aisling", "Alex", "Zed"]);
  assert.deepEqual(result.slice(-2).map((member) => member.firstName), ["Alex", "Zed"]);
  assert.deepEqual(filterMemberRecords(mixed, "all", "all", " murphy ").map((member) => member.id), ["m1"]);
});

test("section youth roles stay independent for concurrent memberships and are cleared when a membership ends", () => {
  const roles = setMemberSectionRole({}, "Beavers", "Lodge Leader", ["Beavers", "Cubs"]);
  const both = setMemberSectionRole(roles, "Cubs", "Seconder", ["Beavers", "Cubs"]);
  assert.deepEqual(both, { Beavers: "Lodge Leader", Cubs: "Seconder" });
  assert.deepEqual(normalizeMemberSectionRoles(both, ["Cubs"]), { Cubs: "Seconder" });
  assert.deepEqual(normalizeMemberSectionRoles({ Beavers: "Sixer", Cubs: "Sixer", Rovers: "Crew Leader" }, ["Beavers", "Cubs"]), { Cubs: "Sixer" });
});

test("role subfilters only match the selected section role and never apply to All Sections", () => {
  const roleMembers = [
    { ...members[0], sections: ["Beavers", "Cubs"], sectionRoles: { Beavers: "Lodge Leader", Cubs: "Seconder" } },
    { ...members[1], sectionRoles: { Cubs: "Sixer" } }
  ];
  assert.deepEqual(filterMembersBySectionRole(roleMembers, "Cubs", "Seconder").map((member) => member.id), ["beaver-active"]);
  assert.deepEqual(filterMembersBySectionRole(roleMembers, "all", "Seconder").map((member) => member.id), ["beaver-active", "cub-active"]);
});
