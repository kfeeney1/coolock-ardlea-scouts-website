import assert from "node:assert/strict";
import test from "node:test";

import { detectMemberLifecycleChange } from "../../src/services/memberLifecycleLogic.ts";

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
