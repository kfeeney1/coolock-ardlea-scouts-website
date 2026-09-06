import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLeaderRole, normalizeLeaderSections } from "../../src/services/leaderAccessLogic.ts";

test("normalizeLeaderRole preserves only supported roles", () => {
    assert.equal(normalizeLeaderRole("leader"), "leader");
    assert.equal(normalizeLeaderRole("admin"), "admin");
    assert.equal(normalizeLeaderRole("super-admin"), "super-admin");
});

test("normalizeLeaderRole rejects unknown or missing values", () => {
    assert.throws(() => normalizeLeaderRole("owner"), /unsupported role/);
    assert.throws(() => normalizeLeaderRole(undefined), /unsupported role/);
});

test("normalizeLeaderSections keeps valid canonical multi-section assignments in Scout order", () => {
    assert.deepEqual(
        normalizeLeaderSections({ sections: ["Rovers", "Cubs", 123, "Beavers", "Ventures", "Scouts", ""] }),
        ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]
    );
});

test("normalizeLeaderSections rejects legacy singular section data", () => {
    assert.deepEqual(normalizeLeaderSections({ section: "Scouts" } as never), []);
});

test("normalizeLeaderSections returns an empty list for invalid assignments", () => {
    assert.deepEqual(normalizeLeaderSections({ sections: "Beavers" }), []);
});
