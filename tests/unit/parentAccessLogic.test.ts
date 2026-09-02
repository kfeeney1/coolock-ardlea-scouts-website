import assert from "node:assert/strict";
import test from "node:test";

import {
  PARENT_ACCESS_STATUSES,
  isParentAccessStatus,
  parentAccessLinks
} from "../../src/services/parentAccessLogic.ts";

test("parent access lifecycle includes explicit revoked state", () => {
  assert.deepEqual(PARENT_ACCESS_STATUSES, ["pending", "approved", "rejected", "revoked"]);
  assert.equal(isParentAccessStatus("revoked"), true);
  assert.equal(isParentAccessStatus("deleted"), false);
});

test("revocation clears all member and section links", () => {
  assert.deepEqual(
    parentAccessLinks("revoked", ["member-1", "member-2"], ["Cubs", "Scouts"]),
    { memberIds: [], linkedSections: [] }
  );
});

test("approved links are trimmed and deduplicated", () => {
  assert.deepEqual(
    parentAccessLinks("approved", ["member-1", " member-1 ", "member-2"], ["Cubs", " Cubs "]),
    { memberIds: ["member-1", "member-2"], linkedSections: ["Cubs"] }
  );
});
