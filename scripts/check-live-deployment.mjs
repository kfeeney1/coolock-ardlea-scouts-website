const siteUrl = String(process.env.SITE_URL || "").replace(/\/$/, "");
const emailApiUrl = String(process.env.EMAIL_API_URL || "").replace(/\/$/, "");
const firebaseApiKey = String(process.env.FIREBASE_API_KEY || "").trim();
const firebaseProjectId = String(process.env.FIREBASE_PROJECT_ID || "coolock-ardlea-scouts").trim();
const allowQuotaWarning = String(process.env.ALLOW_FIRESTORE_QUOTA_WARNING || "").toLowerCase() === "true";
const allowPendingRulesWarning = String(process.env.ALLOW_FIRESTORE_RULES_PENDING_WARNING || "").toLowerCase() === "true";
const EXPECTED_SNAPSHOT_CONTRACT_VERSION = 9;

if (!siteUrl.startsWith("https://")) {
  console.error("SITE_URL must be a valid HTTPS URL.");
  process.exit(1);
}
if (!emailApiUrl.startsWith("https://")) {
  console.error("EMAIL_API_URL must be a valid HTTPS URL.");
  process.exit(1);
}
if (!firebaseApiKey) {
  console.error("FIREBASE_API_KEY is required for the live Firestore probe.");
  process.exit(1);
}
if (!firebaseProjectId) {
  console.error("FIREBASE_PROJECT_ID is required for the live Firestore probe.");
  process.exit(1);
}

const failures = [];
function fail(message) { failures.push(message); console.error(`FAIL: ${message}`); }
function pass(message) { console.log(`PASS: ${message}`); }
function warn(message) { console.warn(`WARN: ${message}`); }

async function get(path) {
  const response = await fetch(`${siteUrl}${path}`, { redirect: "follow" });
  const text = await response.text();
  if (!response.ok) fail(`${path} returned ${response.status}`);
  else pass(`${path} returned ${response.status}`);
  return { response, text };
}

const routes = ["/", "/about", "/join", "/leader/login", "/parent"];
let root;
for (const path of routes) {
  const result = await get(path);
  if (!result.text.includes('id="root"')) fail(`${path} did not return the SPA shell`);
  if (path === "/") root = result;
}

if (root) {
  const headers = root.response.headers;
  const csp = headers.get("content-security-policy") || "";
  for (const directive of ["base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'"]) {
    if (!csp.includes(directive)) fail(`CSP is missing ${directive}`);
    else pass(`CSP contains ${directive}`);
  }
  if (headers.get("x-content-type-options") !== "nosniff") fail("X-Content-Type-Options is not nosniff");
  else pass("X-Content-Type-Options is nosniff");
  if (headers.get("x-frame-options") !== "DENY") fail("X-Frame-Options is not DENY");
  else pass("X-Frame-Options is DENY");

  const assetMatch = root.text.match(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/);
  if (!assetMatch) {
    fail("No hashed Vite asset was found in the live SPA shell");
  } else {
    const asset = await fetch(`${siteUrl}${assetMatch[1]}`);
    if (!asset.ok) fail(`Hashed asset returned ${asset.status}`);
    const cache = asset.headers.get("cache-control") || "";
    if (!cache.includes("immutable") || !cache.includes("max-age=31536000")) fail("Hashed asset does not have immutable one-year caching");
    else pass("Hashed asset has immutable one-year caching");
  }
}

const indexResponse = await fetch(`${siteUrl}/index.html`);
const indexCache = indexResponse.headers.get("cache-control") || "";
if (!indexResponse.ok) fail(`/index.html returned ${indexResponse.status}`);
if (!indexCache.includes("no-store")) fail("SPA shell is not configured with no-store caching");
else pass("SPA shell uses no-store caching");

let hostedSnapshotCount = 0;
let hostedSnapshotValid = false;
const hostedSnapshotResponse = await fetch(`${siteUrl}/public-leadership.json?contract=${EXPECTED_SNAPSHOT_CONTRACT_VERSION}&t=${Date.now()}`, { cache: "no-store" });
if (!hostedSnapshotResponse.ok) {
  fail(`Hosted public organisation snapshot returned ${hostedSnapshotResponse.status}`);
} else {
  const hostedText = await hostedSnapshotResponse.text();
  try {
    const payload = JSON.parse(hostedText);
    if (!Array.isArray(payload)) {
      fail("Hosted public organisation snapshot is valid JSON but is not an array.");
    } else {
      const wrongContract = payload.filter((item) => item?.snapshotContractVersion !== EXPECTED_SNAPSHOT_CONTRACT_VERSION);
      const privilegedLooking = payload.filter((item) => /(^|[_-])(super[_-]?admin|admin)([_-]|$)/i.test(String(item?.uid || "")));
      const ineligible = payload.filter((item) => item?.publicEligible !== true || item?.showPublicly !== true || item?.active === false);
      if (wrongContract.length > 0) fail(`Hosted public organisation snapshot contains ${wrongContract.length} record(s) from an outdated contract.`);
      if (privilegedLooking.length > 0) fail(`Hosted public organisation snapshot contains ${privilegedLooking.length} admin/super-admin-shaped UID(s).`);
      if (ineligible.length > 0) fail(`Hosted public organisation snapshot contains ${ineligible.length} ineligible record(s).`);
      hostedSnapshotValid = wrongContract.length === 0 && privilegedLooking.length === 0 && ineligible.length === 0;
      hostedSnapshotCount = payload.length;
      if (hostedSnapshotValid) pass(`Hosted public organisation snapshot uses contract v${EXPECTED_SNAPSHOT_CONTRACT_VERSION} with ${hostedSnapshotCount} leader(s)`);
    }
  } catch {
    if (hostedText.includes('id="root"')) fail("Hosted public organisation snapshot is missing; Firebase Hosting returned the SPA shell fallback.");
    else fail("Hosted public organisation snapshot is not valid JSON.");
  }
}

console.log(`Checking anonymous publicLeadership access in Firebase project '${firebaseProjectId}'.`);
const publicLeadershipUrl = new URL(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/databases/(default)/documents/publicLeadership`);
publicLeadershipUrl.searchParams.set("key", firebaseApiKey);
const publicLeadershipResponse = await fetch(publicLeadershipUrl);
if (!publicLeadershipResponse.ok) {
  let detail = "";
  try {
    const body = await publicLeadershipResponse.json();
    detail = body?.error?.message ? `: ${body.error.message}` : "";
  } catch {}
  const message = `Anonymous publicLeadership Firestore read returned ${publicLeadershipResponse.status}${detail}`;
  if (publicLeadershipResponse.status === 429 && (allowQuotaWarning || hostedSnapshotValid)) warn(`${message}. Public page remains independent because the hosted snapshot is valid.`);
  else if (publicLeadershipResponse.status === 403 && allowPendingRulesWarning && hostedSnapshotValid) warn(`${message}. This pull request contains the public-read rule, but production Firestore rules are only deployed after merge.`);
  else fail(message);
} else {
  const payload = await publicLeadershipResponse.json();
  const documentCount = Array.isArray(payload.documents) ? payload.documents.length : 0;
  if (documentCount === 0 && hostedSnapshotCount === 0) warn("Anonymous publicLeadership Firestore read returned 200 but both Firestore and the hosted snapshot are empty. No leaders are currently published.");
  else pass(`Anonymous publicLeadership Firestore read returned 200 with ${documentCount} document(s)`);
}

const corsResponse = await fetch(`${emailApiUrl}/leader-communication`, {
  method: "OPTIONS",
  headers: { Origin: siteUrl, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" }
});
if (corsResponse.status !== 204) fail(`Email Worker preflight returned ${corsResponse.status}`);
else pass("Email Worker preflight returned 204");
const allowedOrigin = corsResponse.headers.get("access-control-allow-origin") || "";
if (allowedOrigin !== siteUrl) fail(`Email Worker allows origin '${allowedOrigin}' instead of '${siteUrl}'`);
else pass("Email Worker allows the production site origin");

if (failures.length) {
  console.error(`\nLive deployment smoke check failed with ${failures.length} issue(s).`);
  process.exit(1);
}
console.log("\nLive deployment smoke check passed.");
