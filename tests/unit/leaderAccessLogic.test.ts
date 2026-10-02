import assert from "node:assert/strict";
import test from "node:test";

import { sortLeaderAccessRecords } from "../../src/services/leaderAccessLogic.ts";

const records = [
  { uid: "secondary-z", displayName: "Aardvark Leader", primarySection: "Scouts" },
  { uid: "primary-b", displayName: "Zebra Leader", primarySection: "Cubs" },
  { uid: "primary-a", displayName: "Zebra Leader", primarySection: "Cubs" },
  { uid: "secondary-a", displayName: "Aardvark Leader", primarySection: "Beavers" },
];

test("SW-257 puts selected primary-section leaders before other matching leaders", () => {
  const ordered = sortLeaderAccessRecords(records, "Cubs");

  assert.deepEqual(
    ordered.map(({ uid }) => uid),
    ["primary-a", "primary-b", "secondary-a", "secondary-z"],
  );
  assert.deepEqual(records.map(({ uid }) => uid), [
    "secondary-z",
    "primary-b",
    "primary-a",
    "secondary-a",
  ]);
});

test("SW-257 preserves name and UID ordering when all sections are selected", () => {
  assert.deepEqual(
    sortLeaderAccessRecords(records, "").map(({ uid }) => uid),
    ["secondary-a", "secondary-z", "primary-a", "primary-b"],
  );
});
