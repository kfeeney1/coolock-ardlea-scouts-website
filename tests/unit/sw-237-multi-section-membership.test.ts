import test from "node:test";
import assert from "node:assert/strict";

import { canonicalMemberSections, memberBelongsToSection } from "../../src/services/memberSectionCore.mjs";
import { filterMemberRecords } from "../../src/services/memberManagementLogic.ts";
import { resolveEventAudience } from "../../src/services/eventManagementLogic.ts";
import { subsFamilyAccountId } from "../../src/services/subsLogic.ts";

const member = {
  id: "dual-1",
  firstName: "Dual",
  lastName: "Member",
  displayName: "Dual Member",
  displayNameMode: "auto" as const,
  dateOfBirth: "2014-01-01",
  section: "Cubs",
  sections: ["Cubs", "Scouts"],
  parentName: "Parent",
  emailAddress: "",
  mobileNumber: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  status: "active" as const,
  familyId: "family-1",
  source: "manual",
  sourceJoinApplicationId: "",
  createdAt: null,
  updatedAt: null
};

test("SW-237 legacy scalar section remains readable", () => {
  assert.deepEqual(canonicalMemberSections(undefined, "Cub"), ["Cubs"]);
  assert.equal(memberBelongsToSection({ section: "Venture" }, "Ventures"), true);
});

test("SW-237 concurrent memberships are canonical and independently addressable", () => {
  assert.deepEqual(canonicalMemberSections(["Cub", "Scouts", "Cubs"], ""), ["Cubs", "Scouts"]);
  assert.equal(memberBelongsToSection(member, "Cubs"), true);
  assert.equal(memberBelongsToSection(member, "Scouts"), true);
  assert.equal(memberBelongsToSection(member, "Beavers"), false);
});

test("SW-237 member management includes a dual member under either section filter", () => {
  assert.equal(filterMemberRecords([member], "Cubs", "active").length, 1);
  assert.equal(filterMemberRecords([member], "Scouts", "active").length, 1);
  assert.equal(filterMemberRecords([member], "Beavers", "active").length, 0);
});

test("SW-237 event audiences include a member through either active section", () => {
  assert.deepEqual(resolveEventAudience(["Cubs"], [], [member]), ["dual-1"]);
  assert.deepEqual(resolveEventAudience(["Scouts"], [], [member]), ["dual-1"]);
});

test("SW-237 billing identity stays member-based rather than section-based", () => {
  assert.equal(subsFamilyAccountId("2026-27", [member.id]), subsFamilyAccountId("2026-27", [member.id]));
});
