import { handleEventRosterReport } from "./eventRosterReport.js";
import { handleConsentPrint } from "./consentPrint.js";
import { handleGuardianContactExport } from "./guardianContactExport.js";
import { handleFinancialSummary } from "./financialSummary.js";
import { handleChairpersonReports } from "./chairpersonReports.js";
import { handleMemberMedical } from "./memberMedical.js";
import {handleYouthConsentStatus} from "./youthConsentStatus.js";
import {discoverEventDocuments} from "./eventDiscovery.js";
import {handleHallBookingRoute} from "./hallBookingRoutes.js";
import {serviceAccessToken} from "./productionRoutes.js";
export const hallTestProject = "coolock-ardlea-scouts-test";
export function hallTestOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.origin === origin && url.protocol === "https:" && !url.port && (url.hostname === `${hallTestProject}.web.app` || url.hostname === `${hallTestProject}.firebaseapp.com` || /^coolock-ardlea-scouts-test--[a-z0-9-]+\.web\.app$/.test(url.hostname));
  } catch {return false;}
}
function tokenProject(request) {
  try {
    const token = request.headers.get("Authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
    const claims = JSON.parse(atob(token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")));
    return claims.aud === hallTestProject && claims.iss === `https://securetoken.google.com/${hallTestProject}`;
  } catch {return false;}
}
async function readTestEventPaths(request, env, getToken, headers, reply) {
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: {
    ...headers, "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  }});
  if (request.method !== "POST") return reply(405, {ok: false, error: "Method not allowed."});
  if (request.headers.has("Authorization") && !tokenProject(request)) {
    return reply(401, {ok: false, error: "Current TEST sign-in required."});
  }
  let body;
  try { body = await request.json(); }
  catch { return reply(400, {ok: false, error: "Invalid event discovery request."}); }
  if (body?.operation !== "read") return reply(400, {ok: false, error: "Only event discovery reads are supported."});
  try {
    const response = await discoverEventDocuments(request, body, {
      base: `https://firestore.googleapis.com/v1/projects/${hallTestProject}/databases/(default)/documents`,
      serviceToken: () => getToken({
        FIREBASE_PROJECT_ID: hallTestProject,
        FIREBASE_SERVICE_ACCOUNT_EMAIL: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
        FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY
      })
    });
    return new Response(response.body, {status: response.status, headers});
  } catch {
    return reply(502, {ok: false, error: "TEST event discovery is unavailable."});
  }
}

/** Project hints only reject early; Firestore still verifies the token signature/identity. */
export async function handleTestHallRequest(request, env, getToken = serviceAccessToken, fetcher = fetch) {
  const origin = request.headers.get("Origin") ?? "", permitted = hallTestOrigin(origin);
  const headers = {"Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin", ...(permitted ? {"Access-Control-Allow-Origin": origin, "Access-Control-Expose-Headers": "X-Hall-Backend-Commit"} : {})};
  const reply = (status, value) => new Response(JSON.stringify(value), {status, headers});
  if (env.FIREBASE_PROJECT_ID !== hallTestProject || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST
    || typeof env.FIREBASE_SERVICE_ACCOUNT_EMAIL !== "string" || !/^[a-z0-9-]+@coolock-ardlea-scouts-test\.iam\.gserviceaccount\.com$/.test(env.FIREBASE_SERVICE_ACCOUNT_EMAIL)
    || !env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY || !/^[a-f0-9]{40}$/.test(env.HALL_BUILD_COMMIT ?? "")) return reply(503, {ok: false, error: "Isolated TEST booking configuration is unavailable."});
  headers["X-Hall-Backend-Commit"] = env.HALL_BUILD_COMMIT;
  const path = new URL(request.url).pathname;
  if (path === "/health" && request.method === "GET") return reply(200, {service: "hall-bookings-test", environment: "test", project: hallTestProject, commit: env.HALL_BUILD_COMMIT});
  if (path !== "/hall-bookings" && path !== "/event-discovery" && path !== "/youth-consent-status" && path !== "/member-medical" && path !== "/chairperson-reports" && path !== "/financial-summary" && path !== "/guardian-contact-export" && path !== "/consent-print" && path !== "/event-roster-report") return reply(404, {ok: false, error: "Route not found."});
  if (!permitted) return reply(403, {ok: false, error: "TEST origin required."});
  if (path === "/youth-consent-status" || path === "/member-medical" || path === "/chairperson-reports" || path === "/financial-summary" || path === "/guardian-contact-export" || path === "/consent-print" || path === "/event-roster-report") {
    if (request.method === "POST" && !tokenProject(request)) return reply(401, {ok: false});
    const handlers = { "/member-medical": handleMemberMedical, "/youth-consent-status": handleYouthConsentStatus, "/chairperson-reports": handleChairpersonReports, "/financial-summary": handleFinancialSummary, "/guardian-contact-export": handleGuardianContactExport, "/consent-print": handleConsentPrint, "/event-roster-report": handleEventRosterReport };
      const handler = handlers[path];
    return handler(request, {
      base: `https://firestore.googleapis.com/v1/projects/${hallTestProject}/databases/(default)/documents`,
      serviceToken: () => getToken(env), origin, fetcher
    });
  }
  if (path === "/event-discovery") return readTestEventPaths(request, env, getToken, headers, reply);
  if (request.method === "POST" && !tokenProject(request)) return reply(401, {ok: false, error: "Current TEST sign-in required."});
  // No mail dispatcher, scheduler or user-supplied project/origin binding is forwarded.
  const result = await handleHallBookingRoute(request, {FIREBASE_PROJECT_ID: hallTestProject, FIREBASE_SERVICE_ACCOUNT_EMAIL: env.FIREBASE_SERVICE_ACCOUNT_EMAIL, FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY, ALLOWED_ORIGINS: origin}, getToken, fetcher);
  result.headers.set("X-Hall-Backend-Commit", env.HALL_BUILD_COMMIT); result.headers.set("Access-Control-Expose-Headers", "X-Hall-Backend-Commit");
  return result;
}
export default {fetch(request, env) {return handleTestHallRequest(request, env);}};
