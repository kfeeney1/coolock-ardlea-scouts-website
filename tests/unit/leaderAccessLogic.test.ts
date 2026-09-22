import assert from "node:assert/strict";
import test from "node:test";
import {
    canonicalLeaderAppointments,
    canonicalOrganisationSection,
    normalizeLeaderRole,
    normalizeLeaderSections
} from "../../src/services/leaderAccessLogic.ts";

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

test("normalizeLeaderSections reads legacy singular section data as a one-item scope", () => {
    assert.deepEqual(normalizeLeaderSections({ section: "Scouts" }), ["Scouts"]);
});

test("normalizeLeaderSections reads legacy scalar sections data as a one-item scope", () => {
    assert.deepEqual(normalizeLeaderSections({ sections: "Cubs" }), ["Cubs"]);
});

test("normalizeLeaderSections returns an empty list for invalid assignments", () => {
    assert.deepEqual(normalizeLeaderSections({ sections: 42 }), []);
});

test("canonical organisation section cannot retain a removed legacy assignment", () => {
    assert.equal(canonicalOrganisationSection(["Cubs", "Scouts"], "Beavers"), "Cubs");
    assert.equal(canonicalOrganisationSection(["Group"], "Scouts"), "Group");
});

test("canonical organisation section preserves a valid existing assignment", () => {
    assert.equal(canonicalOrganisationSection(["Cubs", "Scouts"], "Scouts"), "Scouts");
});

test("canonical appointments remap stale section scope without converting group leadership", () => {
    assert.deepEqual(
        canonicalLeaderAppointments([
            { appointment: "Programme Scouter", scope: "Beavers", active: true },
            { appointment: "Group Leader", scope: "Cubs", active: true },
            { appointment: "Group Treasurer", scope: "Scouts", active: true },
            { appointment: "Programme Scouter", scope: "Rovers", active: true }
        ], ["Cubs", "Scouts"], "", "Beavers"),
        [
            { id: "programme-scouter--cubs", appointment: "Programme Scouter", scope: "Cubs", active: true },
            { id: "group-leader--group", appointment: "Group Leader", scope: "Group", active: true },
            { id: "group-treasurer--group", appointment: "Group Treasurer", scope: "Group", active: true }
        ]
    );
});
