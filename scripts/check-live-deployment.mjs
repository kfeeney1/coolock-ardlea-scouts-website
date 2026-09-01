const siteUrl = String(process.env.SITE_URL || "").replace(/\/$/, "");
const emailApiUrl = String(process.env.EMAIL_API_URL || "").replace(/\/$/, "");
const firebaseApiKey = String(process.env.FIREBASE_API_KEY || "").trim();
const firebaseProjectId = String(process.env.FIREBASE_PROJECT_ID || "coolock-ardlea-scouts").trim();
const firebaseStorageBucket = String(process.env.FIREBASE_STORAGE_BUCKET || "").trim();
const expectedBuildSha = String(process.env.EXPECTED_BUILD_SHA || "").trim();
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
if (!firebaseStorageBucket) {
  console.error("FIREBASE_STORAGE_BUCKET is required for the live Storage probe.");
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

function javascriptReferences(source, sourceUrl) {
  const references = new Set();
  const patterns = [
    /["'](\/assets\/[^"'\s]+\.js)["']/g,
    /["'](\.\.?\/[^"'\s]+\.js)["']/g,
    /["'](assets\/[^"'\s]+\.js)["']/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      try {
        const reference = match[1];
        const url = new URL(reference.startsWith("assets/") ? `/${reference}` : reference, sourceUrl);
        if (url.origin === new URL(siteUrl).origin && url.pathname.startsWith("/assets/")) references.add(url.href);
      } catch {}
    }
  }
  return [...references];
}

async function loadJavascriptGraph(entryPath) {
  const entryUrl = new URL(entryPath, siteUrl).href;
  const queue = [entryUrl];
  const seen = new Set();
  const sources = [];
  let entryCache = "";
  while (queue.length && seen.size < 100) {
    const url = queue.shift();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      fail(`JavaScript asset ${new URL(url).pathname} returned ${response.status}`);
      continue;
    }
    if (url === entryUrl) entryCache = response.headers.get("cache-control") || "";
    const source = await response.text();
    sources.push(source);
    for (const reference of javascriptReferences(source, url)) {
      if (!seen.has(reference)) queue.push(reference);
    }
  }
  return { sources, assetCount: seen.size, entryCache };
}

const routes = ["/", "/about", "/join", "/leader/login", "/parent"];
let root;
for (const path of routes) {
  const result = await get(path);
  if (!result.text.includes('id="root"')) fail(`${path} did not return the SPA shell`);
  if (path === "/") root = result;
}

if (root) {
  const buildMatch = root.text.match(/<meta\s+name=["']app-build-sha["']\s+content=["']([^"']+)["']/i);
  const liveBuildSha = buildMatch?.[1]?.trim() || "";
  if (!liveBuildSha) {
    pendingOrFail("Live SPA shell has no app-build-sha fingerprint.");
  } else if (expectedBuildSha && liveBuildSha !== expectedBuildSha) {
    fail(`Live Hosting is serving build ${liveBuildSha}, expected ${expectedBuildSha}.`);
  } else {
    pass(`Live SPA shell identifies deployed build ${liveBuildSha}.`);
  }

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
  if (headers.get("referrer-policy") !== "strict-origin-when-cross-origin") fail("Referrer-Policy is not strict-origin-when-cross-origin");
  else pass("Referrer-Policy is strict-origin-when-cross-origin");
  if (headers.get("permissions-policy") !== "camera=(), microphone=(), geolocation=()") fail("Permissions-Policy does not match the production baseline");
  else pass("Permissions-Policy matches the production baseline");

  const jsMatch = root.text.match(/src=["'](\/assets\/[^"']+\.js)["']/);
  if (!jsMatch) {
    fail("No hashed Vite JavaScript asset was found in the live SPA shell");
  } else {
    const graph = await loadJavascriptGraph(jsMatch[1]);
    if (!graph.entryCache.includes("immutable") || !graph.entryCache.includes("max-age=31536000")) fail("Hashed JavaScript asset does not have immutable one-year caching");
    else pass("Hashed JavaScript asset has immutable one-year caching");

    const allJavascript = graph.sources.join("\n");
    if (allJavascript.includes("public-leadership.json")) {
      pendingOrFail("Live JavaScript graph still references the obsolete public-leadership.json snapshot.");
    } else {
      pass(`Live JavaScript graph (${graph.assetCount} asset(s)) does not reference the obsolete public-leadership.json snapshot`);
    }
    if (!allJavascript.includes("publicLeadership")) {
      pendingOrFail("Live JavaScript graph does not contain the publicLeadership Firestore collection reference.");
    } else {
      pass("Live JavaScript graph contains the publicLeadership Firestore collection reference");
    }
  }
}

const indexResponse = await fetch(`${siteUrl}/index.html`, { cache: "no-store" });
const indexCache = indexResponse.headers.get("cache-control") || "";
if (!indexResponse.ok) fail(`/index.html returned ${indexResponse.status}`);
if (!indexCache.includes("no-store")) fail("SPA shell is not configured with no-store caching");
else pass("SPA shell uses no-store caching");

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

console.log(`Checking anonymous publicLeadership query in Firebase project '${firebaseProjectId}'.`);
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/databases/(default)/documents`;
const unrestrictedUrl = new URL(`${firestoreBase}/publicLeadership`);
unrestrictedUrl.searchParams.set("key", firebaseApiKey);
const unrestrictedResponse = await fetch(unrestrictedUrl, { cache: "no-store" });
if (unrestrictedResponse.status === 403) {
  pass("Unrestricted anonymous publicLeadership collection listing is denied");
} else if (unrestrictedResponse.ok) {
  fail("Unrestricted anonymous publicLeadership collection listing unexpectedly succeeded");
} else {
  fail(`Unrestricted anonymous publicLeadership collection listing returned unexpected ${unrestrictedResponse.status}`);
}

const queryUrl = new URL(`${firestoreBase}:runQuery`);
queryUrl.searchParams.set("key", firebaseApiKey);
const queryResponse = await fetch(queryUrl, {
  method: "POST",
  cache: "no-store",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: "publicLeadership" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "publicProjectionVersion" }, op: "EQUAL", value: { integerValue: "2" } } },
            { fieldFilter: { field: { fieldPath: "sourceAccessRole" }, op: "EQUAL", value: { stringValue: "leader" } } },
            { fieldFilter: { field: { fieldPath: "active" }, op: "EQUAL", value: { booleanValue: true } } },
            { fieldFilter: { field: { fieldPath: "showPublicly" }, op: "EQUAL", value: { booleanValue: true } } }
          ]
        }
      }
    }
  })
});
if (!queryResponse.ok) {
  let detail = "";
  try {
    const body = await queryResponse.json();
    detail = body?.error?.message ? `: ${body.error.message}` : "";
  } catch {}
  const message = `Constrained anonymous publicLeadership query returned ${queryResponse.status}${detail}`;
  if (allowPendingDeployWarning) warn(`${message}. Production rules may still be pending this PR's merge deployment.`);
  else fail(message);
} else {
  const payload = await queryResponse.json();
  const documents = Array.isArray(payload) ? payload.map((item) => item?.document).filter(Boolean) : [];
  const privilegedLooking = documents.filter((document) => {
    const uid = String(document?.name || "").split("/").pop() || "";
    return /(^|[_-])(super[_-]?admin|admin)([_-]|$)/i.test(uid);
  });
  const invalidProjection = documents.filter((document) => {
    const fields = document?.fields || {};
    return String(fields.publicProjectionVersion?.integerValue || "") !== "2"
      || fields.sourceAccessRole?.stringValue !== "leader"
      || fields.active?.booleanValue !== true
      || fields.showPublicly?.booleanValue !== true;
  });
  if (privilegedLooking.length > 0) fail(`publicLeadership query exposed ${privilegedLooking.length} admin/super-admin-shaped document ID(s).`);
  if (invalidProjection.length > 0) fail(`publicLeadership query returned ${invalidProjection.length} document(s) outside the public projection contract.`);
  if (privilegedLooking.length === 0 && invalidProjection.length === 0) pass(`Constrained anonymous publicLeadership query returned 200 with ${documents.length} valid public document(s)`);
}

console.log(`Checking Firebase Storage bucket '${firebaseStorageBucket}'.`);
const storageUrl = new URL(`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(firebaseStorageBucket)}/o`);
storageUrl.searchParams.set("maxResults", "1");
const storageResponse = await fetch(storageUrl, { cache: "no-store" });
if (storageResponse.status === 401 || storageResponse.status === 403) {
  pass(`Firebase Storage is reachable and rejects anonymous bucket listing (${storageResponse.status})`);
} else if (storageResponse.ok) {
  fail("Firebase Storage unexpectedly permits anonymous bucket listing");
} else {
  let detail = "";
  try {
    const body = await storageResponse.json();
    detail = body?.error?.message ? `: ${body.error.message}` : "";
  } catch {}
  fail(`Firebase Storage availability probe returned ${storageResponse.status}${detail}`);
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
