import assert from "node:assert/strict";
import test from "node:test";

import { familySearchResults, planFamilyLink, planFamilyUnlink } from "../../src/services/familyRelationshipLogic.ts";

const member = (id: string, familyId = "", section = "Cubs") => ({ id, familyId, displayName: `Member ${id}`, section });

test("links two unrelated members into one canonical family", () => {
  const members = [member("a"), member("b")];
  assert.deepEqual(planFamilyLink(members, "a", "b", "family-new"), [
    { memberId: "a", familyId: "family-new" },
    { memberId: "b", familyId: "family-new" }
  ]);
});

test("adds a third sibling to an existing family", () => {
  const members = [member("a", "family-1"), member("b", "family-1"), member("c")];
  assert.deepEqual(planFamilyLink(members, "a", "c", "unused"), [
    { memberId: "a", familyId: "family-1" },
    { memberId: "b", familyId: "family-1" },
    { memberId: "c", familyId: "family-1" }
  ]);
});

test("merges two existing family groups without pairwise sibling records", () => {
  const members = [member("a", "family-a"), member("b", "family-a"), member("c", "family-b"), member("d", "family-b")];
  assert.deepEqual(planFamilyLink(members, "a", "c", "unused"), [
    { memberId: "a", familyId: "family-a" },
    { memberId: "b", familyId: "family-a" },
    { memberId: "c", familyId: "family-a" },
    { memberId: "d", familyId: "family-a" }
  ]);
});

test("does nothing when both members are already in the same family", () => {
  const members = [member("a", "family-a"), member("b", "family-a")];
  assert.deepEqual(planFamilyLink(members, "a", "b", "unused"), []);
});

test("unlink clears the final singleton family id", () => {
  const members = [member("a", "family-a"), member("b", "family-a")];
  assert.deepEqual(planFamilyUnlink(members, "a"), [
    { memberId: "a", familyId: "" },
    { memberId: "b", familyId: "" }
  ]);
});

test("unlink from a three-child family keeps the remaining family intact", () => {
  const members = [member("a", "family-a"), member("b", "family-a"), member("c", "family-a")];
  assert.deepEqual(planFamilyUnlink(members, "a"), [{ memberId: "a", familyId: "" }]);
});

test("search excludes the current member and existing family members", () => {
  const members = [member("a", "family-a"), member("b", "family-a"), member("c", "", "Scouts")];
  assert.deepEqual(familySearchResults(members, members[0], "member"), [members[2]]);
});
