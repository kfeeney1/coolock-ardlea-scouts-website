import assert from "node:assert/strict";
import test from "node:test";

import { buildReleaseHealth, configuredCapabilityHealth } from "../../src/services/operationalHealth.ts";

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
