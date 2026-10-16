import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type FieldIndex = { order?: string; queryScope: string };

test("parent event audience collection-group queries have memberId indexes", () => {
    const config = JSON.parse(readFileSync("firestore.indexes.json", "utf8")) as {
        fieldOverrides: Array<{ collectionGroup: string; fieldPath: string; indexes: FieldIndex[] }>;
    };
    const memberId = config.fieldOverrides.find((override) =>
        override.collectionGroup === "audienceMembers" && override.fieldPath === "memberId"
    );

    assert.ok(memberId, "the filtered audienceMembers collection-group query needs an explicit single-field override");
    assert.deepEqual(
        memberId.indexes.map(({ queryScope, order }) => `${queryScope}:${order}`).sort(),
        [
            "COLLECTION:ASCENDING",
            "COLLECTION:DESCENDING",
            "COLLECTION_GROUP:ASCENDING",
            "COLLECTION_GROUP:DESCENDING"
        ]
    );
});
