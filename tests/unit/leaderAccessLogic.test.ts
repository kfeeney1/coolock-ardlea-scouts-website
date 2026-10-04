import assert from "node:assert/strict";
import test from "node:test";
import {
    isDeniedLeaderProfileProbe,
    canonicalLeaderAppointments,
    canonicalOrganisationSection,
    normalizeLeaderRole,
    normalizeLeaderSections,
    sortLeaderAccessRecords
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


test("canonical appointments keep Group Trainer group-scoped for section and Group-only leaders", () => {
    assert.deepEqual(
        canonicalLeaderAppointments(
            [{ appointment: "Group Trainer", scope: "Cubs", active: true }],
            ["Cubs", "Scouts"],
            "",
            "Cubs"
        ),
        [{ id: "group-trainer--group", appointment: "Group Trainer", scope: "Group", active: true }]
    );
    assert.deepEqual(
        canonicalLeaderAppointments(
            [{ appointment: "Group Trainer", scope: "Group", active: true }],
            ["Group"],
            "",
            "Group"
        ),
        [{ id: "group-trainer--group", appointment: "Group Trainer", scope: "Group", active: true }]
    );
});

const orderingRecords = [
    { uid: "secondary-z", displayName: "Aardvark Leader", primarySection: "Scouts" },
    { uid: "primary-b", displayName: "Zebra Leader", primarySection: "Cubs" },
    { uid: "primary-a", displayName: "Zebra Leader", primarySection: "Cubs" },
    { uid: "secondary-a", displayName: "Aardvark Leader", primarySection: "Beavers" }
];

test("SW-257 puts selected primary-section leaders before other matching leaders", () => {
    const ordered = sortLeaderAccessRecords(orderingRecords, "Cubs");

    assert.deepEqual(
        ordered.map(({ uid }) => uid),
        ["primary-a", "primary-b", "secondary-a", "secondary-z"]
    );
    assert.deepEqual(orderingRecords.map(({ uid }) => uid), [
        "secondary-z",
        "primary-b",
        "primary-a",
        "secondary-a"
    ]);
});

test("SW-257 preserves name and UID ordering when all sections are selected", () => {
    assert.deepEqual(
        sortLeaderAccessRecords(orderingRecords, "").map(({ uid }) => uid),
        ["secondary-a", "secondary-z", "primary-a", "primary-b"]
    );
});

test("background leader role probe preserves expected denial while service and unknown failures remain errors", () => {
    assert.equal(isDeniedLeaderProfileProbe({ code: "permission-denied" }), true);
    assert.equal(isDeniedLeaderProfileProbe({ code: "firestore/permission-denied" }), true);
    assert.equal(isDeniedLeaderProfileProbe({ code: "unavailable" }), false);
    assert.equal(isDeniedLeaderProfileProbe(new Error("missing or insufficient permissions")), false);
});
