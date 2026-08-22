import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLeaderRole, normalizeLeaderSections } from "../../src/services/leaderAccessLogic.ts";

test("normalizeLeaderRole preserves privileged roles", () => {
    assert.equal(normalizeLeaderRole("admin"), "admin");
    assert.equal(normalizeLeaderRole("super-admin"), "super-admin");
});

test("normalizeLeaderRole defaults unknown values to leader", () => {
    assert.equal(normalizeLeaderRole("owner"), "leader");
    assert.equal(normalizeLeaderRole(undefined), "leader");
});

test("normalizeLeaderSections keeps valid multi-section assignments", () => {
    assert.deepEqual(normalizeLeaderSections({ sections: ["Beavers", "Cubs", 123, ""] }), ["Beavers", "Cubs"]);
});

test("normalizeLeaderSections supports the legacy single section field", () => {
    assert.deepEqual(normalizeLeaderSections({ section: "Scouts" }), ["Scouts"]);
});

test("normalizeLeaderSections returns an empty list for invalid assignments", () => {
    assert.deepEqual(normalizeLeaderSections({ sections: "Beavers", section: 123 }), []);
});
