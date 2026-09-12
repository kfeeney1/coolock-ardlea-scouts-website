import worker from "./index.js";

const PRODUCTION_HOST = "https://coolockardleascouts.ie";
const PRODUCTION_DOMAIN = "coolockardleascouts.ie";
const rawConsoleError = console.error.bind(console);

function clean(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = allowedOrigins(env);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin"
  };
}

function json(request, env, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request, env) }
  });
}

export function privacySafeDiagnostic(args) {
  const values = Array.isArray(args) ? args : [args];
  const label = typeof values[0] === "string" && values[0].trim()
    ? values[0].trim().slice(0, 120)
    : "Email worker error";
  const error = values.find((value) => value instanceof Error);
  const providerStatus = error?.message?.match(/Resend returned\s+(\d{3})/i)?.[1] || "";
  return {
    label,
    detail: {
      code: providerStatus ? "email-provider-error" : "email-worker-error",
      ...(providerStatus ? { providerStatus: Number(providerStatus) } : {})
    }
  };
}

// The underlying worker historically logged Error objects directly. Provider
// errors can contain response bodies with delivery metadata, recipient details
// or other personal information. Keep only a bounded label and safe status/code.
console.error = (...args) => {
  const diagnostic = privacySafeDiagnostic(args);
  rawConsoleError(diagnostic.label, diagnostic.detail);
};

export function validateDeliveryEnvironment(env) {
  const mode = clean(env.EMAIL_DELIVERY_MODE, 32).toLowerCase();
  const redirect = clean(env.TEST_EMAIL_REDIRECT, 254);
  const sender = clean(env.EMAIL_FROM, 320).toLowerCase();
  const siteUrl = clean(env.SITE_URL, 400).replace(/\/$/, "");
  const origins = allowedOrigins(env);

  if (mode === "production") {
    if (redirect) return "Production email cannot use TEST_EMAIL_REDIRECT.";
    if (!sender.includes(`@${PRODUCTION_DOMAIN}`)) return `Production EMAIL_FROM must use ${PRODUCTION_DOMAIN}.`;
    if (siteUrl !== PRODUCTION_HOST) return `Production SITE_URL must be ${PRODUCTION_HOST}.`;
    if (!origins.includes(PRODUCTION_HOST)) return `Production ALLOWED_ORIGINS must include ${PRODUCTION_HOST}.`;
    return "";
  }

  if (mode === "test") {
    if (!redirect || !redirect.includes("@")) return "TEST email requires a valid TEST_EMAIL_REDIRECT.";
    return "";
  }

  return "EMAIL_DELIVERY_MODE must be explicitly set to production or test.";
}

function bearer(request) {
  const auth = request.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

async function getDocument(env, token, collection, id) {
  if (!token || !id) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}

function fieldString(document, key) {
  return document?.fields?.[key]?.stringValue || "";
}

function fieldStringArray(document, key) {
  const values = document?.fields?.[key]?.arrayValue?.values;
  if (!Array.isArray(values)) return [];
  return values.map((value) => value?.stringValue || "").filter(Boolean);
}

async function authoritativeStatusRequest(request, env, body, path) {
  const token = bearer(request);
  if (!token) return { error: json(request, env, 401, { ok: false, error: "Sign-in required." }) };

  if (path === "/parent-access-approved" || path === "/parent-access-rejected") {
    const accountUid = clean(body.parentAccountUid, 200);
    if (!accountUid) return { error: json(request, env, 400, { ok: false, error: "Parent account id is required." }) };
    const account = await getDocument(env, token, "parentAccounts", accountUid);
    if (!account) return { error: json(request, env, 403, { ok: false, error: "Parent account unavailable for this administrator." }) };
    const email = fieldString(account, "email").trim().toLowerCase();
    if (!email.includes("@")) return { error: json(request, env, 409, { ok: false, error: "Parent account has no valid email address." }) };
    return {
      body: {
        ...body,
        email,
        displayName: fieldString(account, "displayName"),
        childCount: fieldStringArray(account, "memberIds").length
      }
    };
  }

  if (path === "/leader-access-status") {
    const requestUid = clean(body.leaderRequestUid, 200);
    if (!requestUid) return { error: json(request, env, 400, { ok: false, error: "Leader request id is required." }) };
    const registration = await getDocument(env, token, "leaderRegistrationRequests", requestUid);
    if (!registration) return { error: json(request, env, 403, { ok: false, error: "Leader request unavailable for this administrator." }) };
    const email = fieldString(registration, "email").trim().toLowerCase();
    if (!email.includes("@")) return { error: json(request, env, 409, { ok: false, error: "Leader request has no valid email address." }) };
    return {
      body: {
        ...body,
        email,
        displayName: fieldString(registration, "fullName"),
        section: fieldString(registration, "requestedSection")
      }
    };
  }

  return { body };
}

export default {
  async fetch(request, env) {
    const configurationError = validateDeliveryEnvironment(env);
    if (configurationError) {
      return json(request, env, 503, { ok: false, error: "Email delivery is not safely configured." });
    }

    if (request.method !== "POST") return worker.fetch(request, env);

    const path = new URL(request.url).pathname;
    if (!["/parent-access-approved", "/parent-access-rejected", "/leader-access-status"].includes(path)) {
      return worker.fetch(request, env);
    }

    let body;
    try {
      body = await request.clone().json();
    } catch {
      return worker.fetch(request, env);
    }

    const resolved = await authoritativeStatusRequest(request, env, body, path);
    if (resolved.error) return resolved.error;

    const headers = new Headers(request.headers);
    headers.delete("Content-Length");
    const rewritten = new Request(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify(resolved.body)
    });
    return worker.fetch(rewritten, env);
  }
};