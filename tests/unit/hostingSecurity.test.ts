import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type HeaderEntry = { key: string; value: string };
type HeaderRule = { source: string; headers: HeaderEntry[] };
type FirebaseConfig = { hosting?: { headers?: HeaderRule[] } };

const config = JSON.parse(readFileSync(new URL("../../firebase.json", import.meta.url), "utf8")) as FirebaseConfig;
const rules = config.hosting?.headers || [];

function headersFor(source: string): Map<string, string> {
    const rule = rules.find((item) => item.source === source);
    return new Map((rule?.headers || []).map((header) => [header.key.toLowerCase(), header.value]));
}

test("Firebase Hosting applies baseline browser security headers", () => {
    const headers = headersFor("**");
    assert.equal(headers.get("x-content-type-options"), "nosniff");
    assert.equal(headers.get("x-frame-options"), "DENY");
    assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");

    const csp = headers.get("content-security-policy") || "";
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
});

test("SPA shell is not cached while hashed assets are immutable", () => {
    assert.equal(headersFor("/index.html").get("cache-control"), "no-cache, no-store, must-revalidate");
    assert.equal(headersFor("/assets/**").get("cache-control"), "public, max-age=31536000, immutable");
});
