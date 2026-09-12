import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type HeaderEntry = { key: string; value: string };
type HeaderRule = { source: string; headers: HeaderEntry[] };
type FirebaseConfig = { hosting?: { headers?: HeaderRule[] } };

const config = JSON.parse(readFileSync(new URL("../../firebase.json", import.meta.url), "utf8")) as FirebaseConfig;
const rules = config.hosting?.headers || [];
const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../../src/components/Layout.tsx", import.meta.url), "utf8");
const robots = readFileSync(new URL("../../public/robots.txt", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../../public/sitemap.xml", import.meta.url), "utf8");

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

test("production canonical metadata is pinned to the custom apex host", () => {
    assert.match(indexHtml, /rel="canonical" href="https:\/\/coolockardleascouts\.ie\/"/);
    assert.match(layoutSource, /const PRODUCTION_ORIGIN = "https:\/\/coolockardleascouts\.ie"/);
    assert.doesNotMatch(indexHtml + layoutSource + sitemap, /coolock-ardlea-scouts-test|web\.app|firebaseapp\.com/);
});

test("robots and sitemap expose only canonical public production routes", () => {
    assert.match(robots, /Sitemap: https:\/\/coolockardleascouts\.ie\/sitemap\.xml/);
    assert.match(robots, /Disallow: \/leader/);
    assert.match(robots, /Disallow: \/parent/);
    assert.doesNotMatch(sitemap, /\/leader|\/parent|\/event-consent|\/activities\/consent|\/whos-who/);
    for (const path of ["/", "/about", "/activities", "/join", "/contact"]) {
        assert.match(sitemap, new RegExp(`<loc>https://coolockardleascouts\\.ie${path === "/" ? "/" : path}</loc>`));
    }
});
