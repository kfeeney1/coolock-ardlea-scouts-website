import assert from "node:assert/strict";
import test from "node:test";

import {
    DESKTOP_INACTIVITY_TIMEOUT_MS,
    PHONE_INACTIVITY_TIMEOUT_MS,
    isPhoneDevice,
    remainingInactivityMs,
    sessionInactivityTimeoutMs
} from "../../src/services/sessionInactivity.ts";

test("desktop sessions expire after 20 minutes of inactivity", () => {
    assert.equal(sessionInactivityTimeoutMs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), DESKTOP_INACTIVITY_TIMEOUT_MS);
    assert.equal(DESKTOP_INACTIVITY_TIMEOUT_MS, 20 * 60 * 1000);
});

test("phone sessions expire after 90 minutes of inactivity", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
    const androidPhone = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

    assert.equal(isPhoneDevice(iphone), true);
    assert.equal(isPhoneDevice(androidPhone), true);
    assert.equal(sessionInactivityTimeoutMs(iphone), PHONE_INACTIVITY_TIMEOUT_MS);
    assert.equal(PHONE_INACTIVITY_TIMEOUT_MS, 90 * 60 * 1000);
});

test("mobile client hint can identify phones without relying on viewport width", () => {
    assert.equal(sessionInactivityTimeoutMs("Privacy-reduced user agent", true), PHONE_INACTIVITY_TIMEOUT_MS);
    assert.equal(sessionInactivityTimeoutMs("Privacy-reduced user agent", false), DESKTOP_INACTIVITY_TIMEOUT_MS);
});

test("tablet and desktop user agents retain the desktop timeout unless marked mobile", () => {
    const ipad = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
    assert.equal(isPhoneDevice(ipad), false);
    assert.equal(sessionInactivityTimeoutMs(ipad), DESKTOP_INACTIVITY_TIMEOUT_MS);
});

test("remaining inactivity time reaches zero once the timeout is exceeded", () => {
    const lastActivity = 1_000;
    assert.equal(remainingInactivityMs(lastActivity, 1_000 + 5_000, 20_000), 15_000);
    assert.equal(remainingInactivityMs(lastActivity, 1_000 + 20_000, 20_000), 0);
    assert.equal(remainingInactivityMs(lastActivity, 1_000 + 30_000, 20_000), 0);
});
