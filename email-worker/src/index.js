const BRAND = {
  groupName: "80th 160th Coolock Ardlea Scout Group",
  navy: "#17324D",
  coral: "#E76F51",
  background: "#F5F7FA",
  text: "#243447",
  muted: "#667085"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clean(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function brandedEmail({ heading, intro, bodyHtml = "", actionLabel, actionUrl }) {
  const action = actionLabel && actionUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:${BRAND.coral};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px">${escapeHtml(actionLabel)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:${BRAND.background};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:${BRAND.background}"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:10px;overflow:hidden"><tr><td style="padding:28px;background:${BRAND.navy};color:#fff;text-align:center"><div style="font-size:24px;font-weight:800">${BRAND.groupName}</div><div style="font-size:14px;margin-top:6px;opacity:.92">Scout Group Communications</div></td></tr><tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:26px;color:${BRAND.navy}">${escapeHtml(heading)}</h1><p style="font-size:16px;line-height:1.6;margin:0 0 16px">${escapeHtml(intro)}</p>${bodyHtml}${action}</td></tr><tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;color:${BRAND.muted};font-size:12px;line-height:1.5">This message was sent by the Coolock Ardlea Scout Group website.</td></tr></table></td></tr></table></body></html>`;
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = allowedOrigins(env);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(request, env, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request, env) }
  });
}

function originAllowed(request, env) {
  const allowed = allowedOrigins(env);
  if (!allowed.length) return true;
  const origin = request.headers.get("Origin") || "";
  return allowed.includes(origin);
}

function decodeFirebaseUid(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return "";
    const normalised = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded));
    return clean(decoded.user_id || decoded.sub, 200);
  } catch {
    return "";
  }
}

async function requireAdministrator(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  const uid = decodeFirebaseUid(token);
  if (!uid) return false;

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/adminUsers/${encodeURIComponent(uid)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return false;
  const document = await response.json();
  const fields = document.fields || {};
  const active = fields.active?.booleanValue === true;
  const role = fields.role?.stringValue || "leader";
  return active && (role === "admin" || role === "super-admin");
}

async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");
  const recipients = Array.isArray(to) ? to : [to];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: recipients, subject, html })
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
}

async function handleJoinApplication(request, env, body) {
  const recipients = String(env.ADMIN_EMAILS || "").split(",").map((v) => v.trim()).filter(Boolean);
  if (!recipients.length) return json(request, env, 503, { ok: false, error: "Admin email recipients are not configured." });

  const childName = clean(body.childName, 170) || "New applicant";
  const section = clean(body.section, 80) || "Not specified";
  const parentName = clean(body.parentName, 150) || "Not specified";
  const applicationId = clean(body.applicationId, 200);
  if (!applicationId) return json(request, env, 400, { ok: false, error: "Missing application id." });

  const bodyHtml = `<table role="presentation" style="font-size:15px;line-height:1.6;border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0;font-weight:700">Applicant</td><td>${escapeHtml(childName)}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:700">Section</td><td>${escapeHtml(section)}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:700">Parent / Guardian</td><td>${escapeHtml(parentName)}</td></tr></table>`;
  await sendEmail(env, recipients, `New Join Us application – ${childName}`, brandedEmail({
    heading: "New Join Us application",
    intro: "A new application has been submitted through the website.",
    bodyHtml,
    actionLabel: "Review application",
    actionUrl: `${env.SITE_URL}/leader/join`
  }));
  return json(request, env, 200, { ok: true });
}

async function handleParentApproval(request, env, body) {
  if (!(await requireAdministrator(request, env))) return json(request, env, 403, { ok: false, error: "Administrator access required." });

  const email = clean(body.email, 254).toLowerCase();
  const name = clean(body.displayName, 150) || "Parent / Guardian";
  const childCount = Number.isInteger(body.childCount) ? Math.max(0, Math.min(body.childCount, 20)) : 0;
  if (!email || !email.includes("@")) return json(request, env, 400, { ok: false, error: "A valid parent email is required." });

  const bodyHtml = `<p style="font-size:16px;line-height:1.6">Your account has been linked to <strong>${childCount}</strong> member record${childCount === 1 ? "" : "s"}. You can now review and update the consent and medical information available to your account.</p>`;
  await sendEmail(env, email, "Parent access approved – Coolock Ardlea Scouts", brandedEmail({
    heading: "Parent access approved",
    intro: `Hello ${name}, your Parent Portal access has been approved.`,
    bodyHtml,
    actionLabel: "Open Parent Portal",
    actionUrl: `${env.SITE_URL}/parent`
  }));
  return json(request, env, 200, { ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (request.method !== "POST") return json(request, env, 405, { ok: false, error: "Method not allowed." });
    if (!originAllowed(request, env)) return json(request, env, 403, { ok: false, error: "Origin not allowed." });

    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 20000) return json(request, env, 413, { ok: false, error: "Request too large." });

    let body;
    try { body = await request.json(); } catch { return json(request, env, 400, { ok: false, error: "Invalid JSON." }); }

    try {
      const path = new URL(request.url).pathname;
      if (path === "/join-application") return await handleJoinApplication(request, env, body);
      if (path === "/parent-access-approved") return await handleParentApproval(request, env, body);
      return json(request, env, 404, { ok: false, error: "Not found." });
    } catch (error) {
      console.error("Email worker error", error);
      return json(request, env, 500, { ok: false, error: "Unable to send email." });
    }
  }
};
