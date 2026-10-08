import assert from "node:assert/strict";
import test from "node:test";

import {
  PARENT_ACCESS_STATUSES,
  isParentAccessStatus,
  parentAccessLinks,
  sortParentAccessRecords
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

test("parent access records sort pending, approved, and disabled statuses with stable names", () => {
  const records = [
    { uid: "disabled-z", displayName: "Zed Disabled", email: "zed@example.test", status: "revoked" as const },
    { uid: "approved-z", displayName: "Zoe Approved", email: "zoe@example.test", status: "approved" as const },
    { uid: "pending-z", displayName: "Zoe Pending", email: "zoe.pending@example.test", status: "pending" as const },
    { uid: "rejected", displayName: "Ada Rejected", email: "ada@example.test", status: "rejected" as const },
    { uid: "approved-a", displayName: "Alice Approved", email: "alice@example.test", status: "approved" as const },
    { uid: "pending-a", displayName: "Alex Pending", email: "alex@example.test", status: "pending" as const },
    { uid: "disabled-a", displayName: "Bryn Disabled", email: "bryn@example.test", status: "revoked" as const }
  ];

  assert.deepEqual(
    sortParentAccessRecords(records).map((record) => record.uid),
    ["pending-a", "pending-z", "approved-a", "approved-z", "rejected", "disabled-a", "disabled-z"]
  );
  assert.deepEqual(records.map((record) => record.uid), ["disabled-z", "approved-z", "pending-z", "rejected", "approved-a", "pending-a", "disabled-a"]);
});

test("filtering and status changes are reflected by the same ordering", () => {
  const records = [
    { uid: "a", displayName: "Alex", email: "alex@example.test", status: "pending" as const },
    { uid: "b", displayName: "Blair", email: "blair@example.test", status: "approved" as const },
    { uid: "c", displayName: "Casey", email: "casey@example.test", status: "revoked" as const }
  ];
  const filtered = records.filter((record) => record.displayName !== "Blair");
  assert.deepEqual(sortParentAccessRecords(filtered).map((record) => record.uid), ["a", "c"]);

  const transitioned = records.map((record) => record.uid === "a" ? { ...record, status: "approved" as const } : record);
  assert.deepEqual(sortParentAccessRecords(transitioned).map((record) => record.uid), ["a", "b", "c"]);
});
