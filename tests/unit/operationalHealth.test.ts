import assert from "node:assert/strict";
import test from "node:test";

import { buildReleaseHealth, configuredCapabilityHealth, summariseOperationalDataHealth } from "../../src/services/operationalHealth.ts";

test("release health accepts valid GitHub deployment evidence without exposing payload data", () => {
    const result = buildReleaseHealth({
        commit: "1234567890abcdef",
        buildTime: "2026-09-02T15:20:00.000Z",
        source: "github-actions"
    });

    assert.equal(result.status, "healthy");
    assert.match(result.detail, /1234567890ab/);
    assert.doesNotMatch(result.detail, /abcdef$/);
});

test("release health warns for malformed or local build evidence", () => {
    assert.equal(buildReleaseHealth(null).status, "warning");
    assert.equal(buildReleaseHealth({ commit: "abc", buildTime: "bad", source: "github-actions" }).status, "warning");
    assert.equal(buildReleaseHealth({ commit: "abc", buildTime: "2026-09-02T15:20:00.000Z", source: "local" }).status, "warning");
});

test("capability health reports only non-sensitive configuration state", () => {
    const configured = configuredCapabilityHealth({
        emailApiUrl: "https://email.example.test",
        storageBucket: "bucket.example.test"
    });
    assert.deepEqual(configured.map((item) => item.status), ["healthy", "healthy", "warning"]);
    assert.ok(configured.every((item) => !item.detail.includes("secret")));

    const missing = configuredCapabilityHealth({ emailApiUrl: "", storageBucket: "" });
    assert.deepEqual(missing.map((item) => item.status), ["healthy", "unavailable", "unavailable"]);
});

test("data health summarises findings without exposing record contents", () => {
    const healthy = summariseOperationalDataHealth([]);
    assert.equal(healthy.item.status, "healthy");
    assert.equal(healthy.findingCount, 0);

    const warning = summariseOperationalDataHealth([
        "members/member-secret: unsupported section Hidden",
        "parentAccounts/parent-secret: references missing member member-secret",
        "members/second-secret: unsupported section Hidden"
    ]);
    assert.equal(warning.item.status, "warning");
    assert.equal(warning.findingCount, 3);
    assert.deepEqual(warning.affectedCollections, ["members", "parentAccounts"]);
    assert.doesNotMatch(warning.item.detail, /member-secret|parent-secret|second-secret/);
});
