import assert from "node:assert/strict";
import test from "node:test";

import {
    isPhoneDevice,
    remainingInactivityMs,
    sessionInactivityTimeoutMs
} from "../../src/services/sessionInactivity.ts";

const settings = {
    parentInactivityMinutes: 20,
    leaderDesktopInactivityMinutes: 20,
    leaderPhoneInactivityMinutes: 90
};

test("parent-only sessions expire after 20 minutes on every device", () => {
    const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

    assert.equal(sessionInactivityTimeoutMs("parent", settings, desktop), 20 * 60 * 1000);
    assert.equal(sessionInactivityTimeoutMs("parent", settings, iphone, true), 20 * 60 * 1000);
});

test("leader desktop sessions use the configured desktop timeout", () => {
    assert.equal(
        sessionInactivityTimeoutMs("leader", settings, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"),
        20 * 60 * 1000
    );
});

test("leader phone sessions use the configured phone timeout", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
    const androidPhone = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

    assert.equal(isPhoneDevice(iphone), true);
    assert.equal(isPhoneDevice(androidPhone), true);
    assert.equal(sessionInactivityTimeoutMs("leader", settings, iphone), 90 * 60 * 1000);
});

test("mobile client hint can identify leader phone sessions without viewport width", () => {
    assert.equal(sessionInactivityTimeoutMs("leader", settings, "Privacy-reduced user agent", true), 90 * 60 * 1000);
    assert.equal(sessionInactivityTimeoutMs("leader", settings, "Privacy-reduced user agent", false), 20 * 60 * 1000);
});

test("tablet user agents retain the leader desktop timeout unless marked mobile", () => {
    const ipad = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
    assert.equal(isPhoneDevice(ipad), false);
    assert.equal(sessionInactivityTimeoutMs("leader", settings, ipad), 20 * 60 * 1000);
});

test("configured values drive timeout calculations", () => {
    const custom = {
        parentInactivityMinutes: 15,
        leaderDesktopInactivityMinutes: 25,
        leaderPhoneInactivityMinutes: 120
    };
    assert.equal(sessionInactivityTimeoutMs("parent", custom, "desktop"), 15 * 60 * 1000);
    assert.equal(sessionInactivityTimeoutMs("leader", custom, "desktop"), 25 * 60 * 1000);
    assert.equal(sessionInactivityTimeoutMs("leader", custom, "mobile", true), 120 * 60 * 1000);
});

test("remaining inactivity time reaches zero once the timeout is exceeded", () => {
    const lastActivity = 1_000;
    assert.equal(remainingInactivityMs(lastActivity, 1_000 + 5_000, 20_000), 15_000);
    assert.equal(remainingInactivityMs(lastActivity, 1_000 + 20_000, 20_000), 0);
    assert.equal(remainingInactivityMs(lastActivity, 1_000 + 30_000, 20_000), 0);
});
