import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("parent event audience membership query has collection-group memberId indexes", () => {
  const config = JSON.parse(readFileSync("firestore.indexes.json", "utf8")) as {
    fieldOverrides: Array<{
      collectionGroup: string;
      fieldPath: string;
      indexes: Array<{ order?: string; queryScope: string }>;
    }>;
  };
  const memberId = config.fieldOverrides.find((field) =>
    field.collectionGroup === "audienceMembers" && field.fieldPath === "memberId"
  );

  assert.ok(memberId, "audienceMembers.memberId must be explicitly indexed for collection-group queries");
  assert.deepEqual(
    memberId.indexes.filter((index) => index.queryScope === "COLLECTION_GROUP").map((index) => index.order).sort(),
    ["ASCENDING", "DESCENDING"]
  );
  assert.deepEqual(
    memberId.indexes.filter((index) => index.queryScope === "COLLECTION").map((index) => index.order).sort(),
    ["ASCENDING", "DESCENDING"]
  );
});
