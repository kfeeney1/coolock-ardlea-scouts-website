import assert from "node:assert/strict";
import test from "node:test";

import { parentLifecycleCandidates } from "../../src/services/parentLifecycleLogic.ts";
import type { MemberRecord } from "../../src/services/memberAdmin.ts";
import type { ParentAccount } from "../../src/services/parentPortal.ts";

const member = (id: string, status: MemberRecord["status"], section = "Cubs"): MemberRecord => ({
  id,
  firstName: id,
  lastName: "Scout",
  displayName: `${id} Scout`,
  dateOfBirth: "2015-01-01",
  section,
  parentName: "Parent",
  emailAddress: "",
  mobileNumber: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  status,
  familyId: "",
  source: "manual",
  sourceJoinApplicationId: "",
  createdAt: null,
  updatedAt: null
});

const parent = (uid: string, memberIds: string[], status: ParentAccount["status"] = "approved"): ParentAccount => ({
  uid,
  email: `${uid}@example.test`,
  displayName: uid,
  mobileNumber: "0870000000",
  status,
  memberIds,
  linkedSections: ["Cubs"],
  requestedChildren: []
});

test("does not consider disabling parent when another linked child remains active", () => {
  const members = [member("a", "active"), member("b", "active")];
  assert.deepEqual(parentLifecycleCandidates([parent("p", ["a", "b"])], members, "a", "inactive"), []);
});

test("offers parent disable when the final active linked child is disabled", () => {
  const members = [member("a", "active"), member("b", "inactive")];
  const result = parentLifecycleCandidates([parent("p", ["a", "b"])], members, "a", "inactive");
  assert.equal(result.length, 1);
  assert.equal(result[0].parent.uid, "p");
});

test("handles multiple explicitly linked parents independently", () => {
  const members = [member("a", "active"), member("b", "active")];
  const result = parentLifecycleCandidates([
    parent("parent-one", ["a"]),
    parent("parent-two", ["a", "b"])
  ], members, "a", "left");
  assert.deepEqual(result.map((item) => item.parent.uid), ["parent-one"]);
});

test("rejected and revoked parent records are not lifecycle candidates", () => {
  const members = [member("a", "active")];
  assert.deepEqual(parentLifecycleCandidates([
    parent("rejected", ["a"], "rejected"),
    parent("revoked", ["a"], "revoked")
  ], members, "a", "inactive"), []);
});

test("reactivating a child never disables parent access", () => {
  const members = [member("a", "inactive")];
  assert.deepEqual(parentLifecycleCandidates([parent("p", ["a"])], members, "a", "active"), []);
});
