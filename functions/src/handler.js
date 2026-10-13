export const EVENT_BACKEND_PROJECT_ID = "coolock-ardlea-scouts-test";
const SITE_URL = "https://coolock-ardlea-scouts-test.web.app";

function allowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.origin === origin && url.protocol === "https:" && (
      ["coolock-ardlea-scouts-test.web.app", "coolock-ardlea-scouts-test.firebaseapp.com"].includes(url.hostname)
      || (url.hostname.startsWith("coolock-ardlea-scouts-test--") && url.hostname.endsWith(".web.app"))
    );
  } catch { return false; }
}

function failure(status, error) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
  });
}

export function createEventSaveHandler({ projectId, verifyIdToken, getServiceAccessToken, saveAudience }) {
  return async (request) => {
    if (projectId !== EVENT_BACKEND_PROJECT_ID) return failure(503, "TEST event backend has an invalid Firebase target.");
    if (request.method !== "POST") return failure(405, "POST is required.");
    const origin = request.headers.get("Origin") || "";
    if (!allowedOrigin(origin)) return failure(403, "Origin is not authorised.");
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return failure(401, "Sign-in required.");
    try { await verifyIdToken(authorization.slice(7)); }
    catch { return failure(401, "Valid TEST sign-in required."); }
    const payload = await request.text();
    if (new TextEncoder().encode(payload).byteLength > 262144) return failure(413, "Event payload is too large.");
    let body;
    try { body = JSON.parse(payload); }
    catch { return failure(400, "A JSON event payload is required."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return failure(400, "An event object is required.");
    try {
      // This endpoint exposes only event persistence. It cannot invoke communication routes.
      const response = await saveAudience(request, {
        FIREBASE_PROJECT_ID: EVENT_BACKEND_PROJECT_ID,
        ALLOWED_ORIGINS: origin || SITE_URL,
        getServiceAccessToken
      }, body);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch {
      console.error("TEST event persistence failed.");
      return failure(503, "Unable to persist this event.");
    }
  };
}
