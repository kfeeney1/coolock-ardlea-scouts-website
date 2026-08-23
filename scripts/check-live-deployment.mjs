const siteUrl = String(process.env.SITE_URL || "").replace(/\/$/, "");
const emailApiUrl = String(process.env.EMAIL_API_URL || "").replace(/\/$/, "");
const firebaseApiKey = String(process.env.FIREBASE_API_KEY || "").trim();
const firebaseProjectId = String(process.env.FIREBASE_PROJECT_ID || "coolock-ardlea-scouts").trim();
const allowPendingDeployWarning = String(process.env.ALLOW_FIRESTORE_ONLY_DEPLOY_PENDING_WARNING || "").toLowerCase() === "true";

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
function pendingOrFail(message) {
  if (allowPendingDeployWarning) warn(`${message} Production is expected to remain on the previous build until this PR merges.`);
  else fail(message);
}

async function get(path) {
  const response = await fetch(`${siteUrl}${path}`, { redirect: "follow", cache: "no-store" });
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

  const jsMatch = root.text.match(/src="(\/assets\/[^"]+\.js)"/);
  if (!jsMatch) {
    fail("No hashed Vite JavaScript asset was found in the live SPA shell");
  } else {
    const asset = await fetch(`${siteUrl}${jsMatch[1]}`, { cache: "no-store" });
    if (!asset.ok) {
      fail(`Hashed JavaScript asset returned ${asset.status}`);
    } else {
      const cache = asset.headers.get("cache-control") || "";
      if (!cache.includes("immutable") || !cache.includes("max-age=31536000")) fail("Hashed JavaScript asset does not have immutable one-year caching");
      else pass("Hashed JavaScript asset has immutable one-year caching");

      const javascript = await asset.text();
      if (javascript.includes("public-leadership.json")) {
        pendingOrFail("Live JavaScript still references the obsolete public-leadership.json snapshot.");
      } else {
        pass("Live JavaScript does not reference the obsolete public-leadership.json snapshot");
      }
      if (!javascript.includes("publicLeadership")) {
        pendingOrFail("Live JavaScript does not contain the publicLeadership Firestore collection reference.");
      } else {
        pass("Live JavaScript contains the publicLeadership Firestore collection reference");
      }
    }
  }
}

const indexResponse = await fetch(`${siteUrl}/index.html`, { cache: "no-store" });
const indexCache = indexResponse.headers.get("cache-control") || "";
if (!indexResponse.ok) fail(`/index.html returned ${indexResponse.status}`);
if (!indexCache.includes("no-store")) fail("SPA shell is not configured with no-store caching");
else pass("SPA shell uses no-store caching");

// The old snapshot must no longer exist as deployable data. Firebase Hosting rewrites a missing path to index.html.
const obsoleteSnapshot = await fetch(`${siteUrl}/public-leadership.json?t=${Date.now()}`, { cache: "no-store" });
const obsoleteSnapshotText = await obsoleteSnapshot.text();
let obsoleteSnapshotIsJsonArray = false;
try {
  obsoleteSnapshotIsJsonArray = Array.isArray(JSON.parse(obsoleteSnapshotText));
} catch {
  obsoleteSnapshotIsJsonArray = false;
}
if (obsoleteSnapshotIsJsonArray) {
  pendingOrFail("Live Hosting still serves public-leadership.json as a data source.");
} else if (obsoleteSnapshotText.includes('id="root"')) {
  pass("Obsolete public-leadership.json is no longer deployed; Hosting returns the SPA fallback");
} else {
  pass("Obsolete public-leadership.json is no longer available as JSON data");
}

console.log(`Checking anonymous publicLeadership access in Firebase project '${firebaseProjectId}'.`);
const publicLeadershipUrl = new URL(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/databases/(default)/documents/publicLeadership`);
publicLeadershipUrl.searchParams.set("key", firebaseApiKey);
const publicLeadershipResponse = await fetch(publicLeadershipUrl, { cache: "no-store" });
if (!publicLeadershipResponse.ok) {
  let detail = "";
  try {
    const body = await publicLeadershipResponse.json();
    detail = body?.error?.message ? `: ${body.error.message}` : "";
  } catch {}
  const message = `Anonymous publicLeadership Firestore read returned ${publicLeadershipResponse.status}${detail}`;
  if (allowPendingDeployWarning) warn(`${message}. Production rules may still be pending this PR's merge deployment.`);
  else fail(message);
} else {
  const payload = await publicLeadershipResponse.json();
  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  const privilegedLooking = documents.filter((document) => {
    const uid = String(document?.name || "").split("/").pop() || "";
    return /(^|[_-])(super[_-]?admin|admin)([_-]|$)/i.test(uid);
  });
  if (privilegedLooking.length > 0) fail(`publicLeadership contains ${privilegedLooking.length} admin/super-admin-shaped document ID(s).`);
  else pass(`Anonymous publicLeadership Firestore read returned 200 with ${documents.length} document(s) and no admin-shaped IDs`);
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
