const BRAND = {
  groupName: "80th 160th Coolock Ardlea Scout Group",
  navy: "#17324D",
  coral: "#E76F51",
  background: "#F5F7FA",
  text: "#243447",
  muted: "#667085"
};

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function clean(value, max = 300) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function brandedEmail({ heading, intro, bodyHtml = "", actionLabel, actionUrl }) {
  const action = actionLabel && actionUrl ? `<p style="margin:28px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:${BRAND.coral};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px">${escapeHtml(actionLabel)}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:${BRAND.background};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:${BRAND.background}"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:10px;overflow:hidden"><tr><td style="padding:28px;background:${BRAND.navy};color:#fff;text-align:center"><div style="font-size:24px;font-weight:800">${BRAND.groupName}</div><div style="font-size:14px;margin-top:6px;opacity:.92">Scout Group Communications</div></td></tr><tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:26px;color:${BRAND.navy}">${escapeHtml(heading)}</h1><p style="font-size:16px;line-height:1.6;margin:0 0 16px">${escapeHtml(intro)}</p>${bodyHtml}${action}</td></tr><tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;color:${BRAND.muted};font-size:12px;line-height:1.5">This message was sent by the Coolock Ardlea Scout Group website.</td></tr></table></td></tr></table></body></html>`;
}
function allowedOrigins(env) { return String(env.ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean); }
function corsHeaders(request, env) { const origin = request.headers.get("Origin") || ""; const allowed = allowedOrigins(env); return { "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" }; }
function json(request, env, status, body) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders(request, env) } }); }
function originAllowed(request, env) { const allowed = allowedOrigins(env); if (!allowed.length) return true; return allowed.includes(request.headers.get("Origin") || ""); }
function decodeFirebaseUid(token) { try { const payload = token.split(".")[1]; if (!payload) return ""; const normalised = payload.replaceAll("-", "+").replaceAll("_", "/"); const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "="); const decoded = JSON.parse(atob(padded)); return clean(decoded.user_id || decoded.sub, 200); } catch { return ""; } }
function bearer(request) { const auth = request.headers.get("Authorization") || ""; return auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""; }
async function getDocument(env, token, collection, uid) { const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${collection}/${encodeURIComponent(uid)}`; const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); return response.ok ? response.json() : null; }
function fieldString(document, key) { return document?.fields?.[key]?.stringValue || ""; }
function fieldBoolean(document, key) { return document?.fields?.[key]?.booleanValue === true; }
function mapString(document, key, childKey) { return document?.fields?.[key]?.mapValue?.fields?.[childKey]?.stringValue || ""; }

async function requireActiveLeader(request, env) {
  const token = bearer(request); const uid = decodeFirebaseUid(token); if (!token || !uid) return null;
  const document = await getDocument(env, token, "adminUsers", uid); if (!document || !fieldBoolean(document, "active")) return null;
  return { token, uid, role: fieldString(document, "role") || "leader" };
}

async function requireAdministrator(request, env) {
  const leader = await requireActiveLeader(request, env);
  return leader && (leader.role === "admin" || leader.role === "super-admin") ? leader : null;
}

async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");
  const intended = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!intended.length) return;
  const redirect = clean(env.TEST_EMAIL_REDIRECT, 254);
  const recipients = redirect ? [redirect] : intended;
  const finalSubject = redirect ? `[TEST for ${intended.join(", ")}] ${subject}` : subject;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.EMAIL_FROM, to: recipients, subject: finalSubject, html }) });
  if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
}
function adminRecipients(env) { return String(env.ADMIN_EMAILS || "").split(",").map(v => v.trim()).filter(Boolean); }

async function handleJoinApplication(request, env, body) {
  const recipients = adminRecipients(env); if (!recipients.length) return json(request, env, 503, { ok: false, error: "Admin email recipients are not configured." });
  const childName = clean(body.childName, 170) || "New applicant"; const section = clean(body.section, 80) || "Not specified"; const parentName = clean(body.parentName, 150) || "Not specified"; const applicationId = clean(body.applicationId, 200); if (!applicationId) return json(request, env, 400, { ok: false, error: "Missing application id." });
  const bodyHtml = `<table role="presentation" style="font-size:15px;line-height:1.6;border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0;font-weight:700">Applicant</td><td>${escapeHtml(childName)}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:700">Section</td><td>${escapeHtml(section)}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:700">Parent / Guardian</td><td>${escapeHtml(parentName)}</td></tr></table>`;
  await sendEmail(env, recipients, `New Join Us application – ${childName}`, brandedEmail({ heading: "New Join Us application", intro: "A new application has been submitted through the website.", bodyHtml, actionLabel: "Review application", actionUrl: `${env.SITE_URL}/leader/join` }));
  return json(request, env, 200, { ok: true });
}

async function handleSelfRegistration(request, env, collectionName, kind) {
  const token = bearer(request); const uid = decodeFirebaseUid(token); if (!token || !uid) return json(request, env, 401, { ok: false, error: "Sign-in required." });
  const document = await getDocument(env, token, collectionName, uid); if (!document) return json(request, env, 403, { ok: false, error: "Registration record unavailable." });
  const email = fieldString(document, "email").toLowerCase(); const name = fieldString(document, kind === "parent" ? "displayName" : "fullName") || (kind === "parent" ? "Parent / Guardian" : "Leader applicant");
  const section = kind === "leader" ? fieldString(document, "requestedSection") : "";
  const requesterHtml = kind === "parent" ? `<p style="font-size:16px;line-height:1.6">Your Parent Portal request has been received and is waiting for an administrator to verify and link your account to the correct member record.</p>` : `<p style="font-size:16px;line-height:1.6">Your Leader Access request has been received${section ? ` for <strong>${escapeHtml(section)}</strong>` : ""}. An administrator will review it before leader areas become available.</p>`;
  await sendEmail(env, email, kind === "parent" ? "Parent access request received – Coolock Ardlea Scouts" : "Leader access request received – Coolock Ardlea Scouts", brandedEmail({ heading: kind === "parent" ? "Parent access request received" : "Leader access request received", intro: `Hello ${name}, thanks for registering.`, bodyHtml: requesterHtml, actionLabel: kind === "parent" ? "Open Parent Portal" : "Open Leader Login", actionUrl: `${env.SITE_URL}/${kind === "parent" ? "parent" : "leader/login"}` }));
  const admins = adminRecipients(env);
  if (admins.length) await sendEmail(env, admins, `New ${kind === "parent" ? "Parent Access" : "Leader Access"} request – ${name}`, brandedEmail({ heading: `New ${kind === "parent" ? "Parent Access" : "Leader Access"} request`, intro: `${name} has submitted a new access request.`, bodyHtml: kind === "leader" && section ? `<p>Requested section: <strong>${escapeHtml(section)}</strong></p>` : "", actionLabel: "Review request", actionUrl: `${env.SITE_URL}/leader/${kind === "parent" ? "parent-access" : "requests"}` }));
  return json(request, env, 200, { ok: true });
}

async function handleParentStatus(request, env, body, status) {
  if (!(await requireAdministrator(request, env))) return json(request, env, 403, { ok: false, error: "Administrator access required." });
  const email = clean(body.email, 254).toLowerCase(); const name = clean(body.displayName, 150) || "Parent / Guardian"; const childCount = Number.isInteger(body.childCount) ? Math.max(0, Math.min(body.childCount, 20)) : 0; if (!email.includes("@")) return json(request, env, 400, { ok: false, error: "A valid parent email is required." });
  if (status === "approved") {
    const bodyHtml = `<p style="font-size:16px;line-height:1.6">Your account has been linked to <strong>${childCount}</strong> member record${childCount === 1 ? "" : "s"}. You can now review and update the consent and medical information available to your account.</p>`;
    await sendEmail(env, email, "Parent access approved – Coolock Ardlea Scouts", brandedEmail({ heading: "Parent access approved", intro: `Hello ${name}, your Parent Portal access has been approved.`, bodyHtml, actionLabel: "Open Parent Portal", actionUrl: `${env.SITE_URL}/parent` }));
  } else {
    await sendEmail(env, email, "Parent access request update – Coolock Ardlea Scouts", brandedEmail({ heading: "Parent access request not approved", intro: `Hello ${name}, your Parent Portal access request was not approved at this time.`, bodyHtml: `<p style="font-size:16px;line-height:1.6">Please contact the Scout Group if you believe this is incorrect or if your details need to be updated.</p>`, actionLabel: "Open Parent Portal", actionUrl: `${env.SITE_URL}/parent` }));
  }
  return json(request, env, 200, { ok: true });
}

async function handleLeaderStatus(request, env, body) {
  if (!(await requireAdministrator(request, env))) return json(request, env, 403, { ok: false, error: "Administrator access required." });
  const email = clean(body.email, 254).toLowerCase(); const name = clean(body.displayName, 150) || "Leader"; const status = body.status === "rejected" ? "rejected" : "approved"; const section = clean(body.section, 80); if (!email.includes("@")) return json(request, env, 400, { ok: false, error: "A valid leader email is required." });
  const approved = status === "approved";
  await sendEmail(env, email, approved ? "Leader access approved – Coolock Ardlea Scouts" : "Leader access request update – Coolock Ardlea Scouts", brandedEmail({ heading: approved ? "Leader access approved" : "Leader access request not approved", intro: `Hello ${name}, ${approved ? "your Leader Access request has been approved." : "your Leader Access request was not approved at this time."}`, bodyHtml: approved && section ? `<p style="font-size:16px;line-height:1.6">Your initial section access is <strong>${escapeHtml(section)}</strong>. An administrator can update your assigned sections later.</p>` : `<p style="font-size:16px;line-height:1.6">Please contact the Scout Group if you need more information.</p>`, actionLabel: "Open Leader Login", actionUrl: `${env.SITE_URL}/leader/login` }));
  return json(request, env, 200, { ok: true });
}

function eventDetailsHtml(event) {
  const title = fieldString(event, "title") || "Scout event";
  const date = fieldString(event, "startDate") || "Date to be confirmed";
  const location = fieldString(event, "location");
  const meetingPoint = fieldString(event, "meetingPoint");
  const returnDetails = fieldString(event, "returnDetails");
  return `<table role="presentation" style="font-size:15px;line-height:1.6;border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0;font-weight:700">Event</td><td>${escapeHtml(title)}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:700">Date</td><td>${escapeHtml(date)}</td></tr>${location ? `<tr><td style="padding:4px 12px 4px 0;font-weight:700">Location</td><td>${escapeHtml(location)}</td></tr>` : ""}${meetingPoint ? `<tr><td style="padding:4px 12px 4px 0;font-weight:700">Meeting point</td><td>${escapeHtml(meetingPoint)}</td></tr>` : ""}${returnDetails ? `<tr><td style="padding:4px 12px 4px 0;font-weight:700">Return</td><td>${escapeHtml(returnDetails)}</td></tr>` : ""}</table>`;
}

async function handleEventNotification(request, env, body) {
  const leader = await requireActiveLeader(request, env);
  if (!leader) return json(request, env, 403, { ok: false, error: "Active leader access required." });

  const eventId = clean(body.eventId, 100);
  const consentToken = clean(body.consentToken, 100);
  const kind = body.kind === "update" || body.kind === "reminder" ? body.kind : "notice";
  const memberIds = Array.isArray(body.memberIds) ? [...new Set(body.memberIds.filter(v => typeof v === "string").map(v => clean(v, 100)).filter(Boolean))].slice(0, 200) : [];
  if (!eventId || !consentToken || !memberIds.length) return json(request, env, 400, { ok: false, error: "Event, consent link and members are required." });

  const event = await getDocument(env, leader.token, "events", eventId);
  if (!event) return json(request, env, 403, { ok: false, error: "Event unavailable for this leader." });
  if (fieldString(event, "status") !== "open") return json(request, env, 409, { ok: false, error: "Only open events can send parent notifications." });

  const link = await getDocument(env, leader.token, "eventConsentLinks", consentToken);
  if (!link || fieldString(link, "eventId") !== eventId || !fieldBoolean(link, "active")) return json(request, env, 409, { ok: false, error: "An active consent link for this event is required." });

  const title = fieldString(event, "title") || "Scout event";
  const actionUrl = `${env.SITE_URL}/event-consent/${encodeURIComponent(consentToken)}`;
  let sent = 0;
  let skipped = 0;

  for (const memberId of memberIds) {
    const member = await getDocument(env, leader.token, "members", memberId);
    if (!member || fieldString(member, "status") !== "active") { skipped += 1; continue; }
    if (kind === "reminder") {
      const consentStatus = mapString(event, "consent", memberId);
      const attendanceStatus = mapString(event, "attendance", memberId);
      if (consentStatus === "received" || attendanceStatus === "not-attending") { skipped += 1; continue; }
    }

    const email = fieldString(member, "emailAddress").toLowerCase();
    if (!email.includes("@")) { skipped += 1; continue; }
    const childName = fieldString(member, "displayName") || "your child";
    const parentName = fieldString(member, "parentName") || "Parent / Guardian";
    const heading = kind === "reminder" ? "Consent reminder" : kind === "update" ? "Event update" : "New event notice";
    const intro = kind === "reminder"
      ? `Hello ${parentName}, we are still waiting for a response for ${childName}.`
      : kind === "update"
        ? `Hello ${parentName}, there is an update for ${childName}'s upcoming event.`
        : `Hello ${parentName}, ${childName} has an upcoming Scout event.`;
    const subject = kind === "reminder" ? `Consent reminder – ${title}` : kind === "update" ? `Event update – ${title}` : `New event – ${title}`;
    const bodyHtml = `${eventDetailsHtml(event)}<p style="font-size:16px;line-height:1.6;margin-top:18px">Please use the button below to confirm attendance${fieldBoolean(event, "consentRequired") ? " and provide event consent" : ""}.</p>`;
    await sendEmail(env, email, subject, brandedEmail({ heading, intro, bodyHtml, actionLabel: "Respond to event", actionUrl }));
    sent += 1;
  }

  return json(request, env, 200, { ok: true, sent, skipped });
}

async function handleLeaderCommunication(request, env, body) {
  const leader = await requireActiveLeader(request, env);
  if (!leader) return json(request, env, 403, { ok: false, error: "Active leader access required." });

  const subject = clean(body.subject, 120);
  const message = clean(body.message, 2500);
  const memberIds = Array.isArray(body.memberIds) ? [...new Set(body.memberIds.filter(v => typeof v === "string").map(v => clean(v, 100)).filter(Boolean))].slice(0, 100) : [];
  if (!subject || !message || !memberIds.length) return json(request, env, 400, { ok: false, error: "Recipients, subject and message are required." });

  let sent = 0;
  let skipped = 0;
  const messageHtml = escapeHtml(message).replaceAll("\n", "<br/>");

  for (const memberId of memberIds) {
    const member = await getDocument(env, leader.token, "members", memberId);
    if (!member || fieldString(member, "status") !== "active") { skipped += 1; continue; }

    const email = fieldString(member, "emailAddress").toLowerCase();
    if (!email.includes("@")) { skipped += 1; continue; }
    const childName = fieldString(member, "displayName") || "your child";
    const parentName = fieldString(member, "parentName") || "Parent / Guardian";
    const bodyHtml = `<p style="font-size:16px;line-height:1.7">${messageHtml}</p><p style="font-size:14px;line-height:1.6;color:${BRAND.muted};margin-top:22px">This message relates to <strong>${escapeHtml(childName)}</strong>.</p>`;
    await sendEmail(env, email, subject, brandedEmail({
      heading: subject,
      intro: `Hello ${parentName},`,
      bodyHtml,
      actionLabel: "Open Parent Portal",
      actionUrl: `${env.SITE_URL}/parent`
    }));
    sent += 1;
  }

  return json(request, env, 200, { ok: true, sent, skipped });
}

async function handleEventConsentProcessed(request, env, body) {
  const leader = await requireActiveLeader(request, env);
  if (!leader) return json(request, env, 403, { ok: false, error: "Active leader access required." });
  const eventId = clean(body.eventId, 100); const memberId = clean(body.memberId, 100);
  if (!eventId || !memberId) return json(request, env, 400, { ok: false, error: "Event and member are required." });

  const event = await getDocument(env, leader.token, "events", eventId);
  const member = await getDocument(env, leader.token, "members", memberId);
  if (!event || !member) return json(request, env, 403, { ok: false, error: "Event or member unavailable for this leader." });
  const email = fieldString(member, "emailAddress").toLowerCase();
  if (!email.includes("@")) return json(request, env, 200, { ok: true, skipped: true });

  const childName = fieldString(member, "displayName") || "your child";
  const parentName = fieldString(member, "parentName") || "Parent / Guardian";
  const attendance = mapString(event, "attendance", memberId) || "invited";
  const consent = mapString(event, "consent", memberId) || (fieldBoolean(event, "consentRequired") ? "required" : "not-required");
  const attendanceText = attendance === "not-attending" ? "Not attending" : attendance === "attending" ? "Attending" : "Invited";
  const consentText = consent === "received" ? "Received" : consent === "not-required" ? "Not required" : "Outstanding";
  const bodyHtml = `${eventDetailsHtml(event)}<p style="font-size:16px;line-height:1.6;margin-top:18px"><strong>${escapeHtml(childName)}</strong><br/>Attendance: ${escapeHtml(attendanceText)}<br/>Consent: ${escapeHtml(consentText)}</p>`;
  await sendEmail(env, email, `Event response confirmed – ${fieldString(event, "title") || "Scout event"}`, brandedEmail({ heading: "Event response confirmed", intro: `Hello ${parentName}, your response for ${childName} has been recorded.`, bodyHtml, actionLabel: "Open Parent Portal", actionUrl: `${env.SITE_URL}/parent` }));
  return json(request, env, 200, { ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (request.method !== "POST") return json(request, env, 405, { ok: false, error: "Method not allowed." });
    if (!originAllowed(request, env)) return json(request, env, 403, { ok: false, error: "Origin not allowed." });
    const length = Number(request.headers.get("Content-Length") || 0); if (length > 20000) return json(request, env, 413, { ok: false, error: "Request too large." });
    let body; try { body = await request.json(); } catch { return json(request, env, 400, { ok: false, error: "Invalid JSON." }); }
    try {
      const path = new URL(request.url).pathname;
      if (path === "/join-application") return await handleJoinApplication(request, env, body);
      if (path === "/parent-registration") return await handleSelfRegistration(request, env, "parentAccounts", "parent");
      if (path === "/leader-registration") return await handleSelfRegistration(request, env, "leaderRegistrationRequests", "leader");
      if (path === "/parent-access-approved") return await handleParentStatus(request, env, body, "approved");
      if (path === "/parent-access-rejected") return await handleParentStatus(request, env, body, "rejected");
      if (path === "/leader-access-status") return await handleLeaderStatus(request, env, body);
      if (path === "/event-notification") return await handleEventNotification(request, env, body);
      if (path === "/leader-communication") return await handleLeaderCommunication(request, env, body);
      if (path === "/event-consent-processed") return await handleEventConsentProcessed(request, env, body);
      return json(request, env, 404, { ok: false, error: "Not found." });
    } catch (error) {
      console.error("Email worker error", error);
      return json(request, env, 500, { ok: false, error: "Unable to send email." });
    }
  }
};