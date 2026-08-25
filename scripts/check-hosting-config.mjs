import { readFile } from "node:fs/promises";

const firebase = JSON.parse(await readFile(new URL("../firebase.json", import.meta.url), "utf8"));
const hosting = firebase?.hosting;
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function headerMap(source) {
  const rule = hosting?.headers?.find((entry) => entry?.source === source);
  return new Map((rule?.headers || []).map((header) => [header.key, header.value]));
}

if (!hosting || hosting.public !== "dist") {
  fail("Firebase Hosting must publish the Vite dist directory.");
} else {
  pass("Firebase Hosting publishes dist.");
}

const globalHeaders = headerMap("**");
const requiredGlobalHeaders = new Map([
  ["Content-Security-Policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'none'"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"]
]);

for (const [key, expected] of requiredGlobalHeaders) {
  const actual = globalHeaders.get(key);
  if (actual !== expected) fail(`${key} must remain '${expected}', found '${actual || "missing"}'.`);
  else pass(`${key} matches the production baseline.`);
}

const indexCache = headerMap("/index.html").get("Cache-Control") || "";
if (!indexCache.includes("no-store") || !indexCache.includes("no-cache")) {
  fail("/index.html must remain non-cacheable with no-cache and no-store.");
} else {
  pass("/index.html remains non-cacheable.");
}

const assetCache = headerMap("/assets/**").get("Cache-Control") || "";
if (!assetCache.includes("max-age=31536000") || !assetCache.includes("immutable")) {
  fail("/assets/** must retain one-year immutable caching.");
} else {
  pass("Hashed assets retain one-year immutable caching.");
}

const spaRewrite = hosting?.rewrites?.some((rewrite) => rewrite?.source === "**" && rewrite?.destination === "/index.html");
if (!spaRewrite) fail("Firebase Hosting must retain the SPA rewrite to /index.html.");
else pass("SPA rewrite to /index.html is present.");

if (failures.length) {
  console.error(`\nHosting configuration check failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("\nHosting configuration check passed.");
