import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalMemberFieldError,
  detectMemberLifecycleChange
} from "../../src/services/memberLifecycleLogic.ts";

const canonicalMember = {
  firstName: "Sam",
  lastName: "Scout",
  displayName: "Sam Scout",
  dateOfBirth: "2015-04-12",
  section: "Cubs"
};

test("canonicalMemberFieldError accepts the fields required by the member loader", () => {
  assert.equal(canonicalMemberFieldError(canonicalMember), null);
});

test("canonicalMemberFieldError rejects a missing canonical field", () => {
  assert.equal(
    canonicalMemberFieldError({ ...canonicalMember, dateOfBirth: "  " }),
    "Member date of birth is required."
  );
});

test("canonicalMemberFieldError reports every missing canonical field", () => {
  assert.equal(
    canonicalMemberFieldError({
      ...canonicalMember,
      firstName: "",
      lastName: " ",
      section: ""
    }),
    "Member first name, last name and section are required."
  );
});

test("detectMemberLifecycleChange treats a new member as created", () => {
  assert.equal(detectMemberLifecycleChange(null, { section: "Cubs", status: "active" }), "created");
});

test("detectMemberLifecycleChange detects section transfers", () => {
  assert.equal(
    detectMemberLifecycleChange(
      { section: "Cubs", status: "active" },
      { section: "Scouts", status: "active" }
    ),
    "section-transfer"
  );
});

test("detectMemberLifecycleChange detects status changes", () => {
  assert.equal(
    detectMemberLifecycleChange(
      { section: "Scouts", status: "active" },
      { section: "Scouts", status: "inactive" }
    ),
    "status-change"
  );
});

test("detectMemberLifecycleChange detects combined section and status changes", () => {
  assert.equal(
    detectMemberLifecycleChange(
      { section: "Cubs", status: "active" },
      { section: "Scouts", status: "inactive" }
    ),
    "section-and-status-change"
  );
});

test("detectMemberLifecycleChange ignores ordinary detail edits", () => {
  assert.equal(
    detectMemberLifecycleChange(
      { section: "Cubs", status: "active" },
      { section: "Cubs", status: "active" }
    ),
    null
  );
});
