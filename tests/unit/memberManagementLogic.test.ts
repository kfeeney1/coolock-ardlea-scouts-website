import assert from "node:assert/strict";
import test from "node:test";

import { filterMemberRecords } from "../../src/services/memberManagementLogic.ts";

const members = [
  { id: "venture-new", displayName: "New Venture", firstName: "New", lastName: "Venture", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", section: "Venture Scout", status: "active" as const },
  { id: "venture-existing", displayName: "Existing Venture", firstName: "Existing", lastName: "Venture", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", section: "Ventures", status: "inactive" as const },
  { id: "scout-existing", displayName: "Existing Scout", firstName: "Existing", lastName: "Scout", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", section: "Scouts", status: "active" as const },
  { id: "venture-left", displayName: "Former Venture", firstName: "Former", lastName: "Venture", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", section: "Ventures", status: "left" as const }
];

test("Member Management section filters include canonical and legacy Venture records", () => {
  assert.deepEqual(filterMemberRecords(members, "Ventures", "all").map((member) => member.id), [
    "venture-new", "venture-existing", "venture-left"
  ]);
  assert.deepEqual(filterMemberRecords(members, "all", "all").map((member) => member.id), members.map((member) => member.id));
});

test("Member Management status filters include only the requested lifecycle state", () => {
  assert.deepEqual(filterMemberRecords(members, "Ventures", "active").map((member) => member.id), ["venture-new"]);
  assert.deepEqual(filterMemberRecords(members, "all", "inactive").map((member) => member.id), ["venture-existing"]);
  assert.deepEqual(filterMemberRecords(members, "all", "left").map((member) => member.id), ["venture-left"]);
  assert.equal(filterMemberRecords(members, "all", "all", "new venture").length, 1);
});
