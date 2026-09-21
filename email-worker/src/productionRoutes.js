import { reminderDocumentId, reminderRecord, shouldAttemptReminder } from "./reminderPersistence.js";
const BRAND = {
  groupName: "80th 160th Coolock Ardlea Scout Group",
  navy: "#17324D",
  coral: "#E76F51",
  background: "#F5F7FA",
  text: "#243447",
  muted: "#667085"
};

let cachedServiceToken = null;
let cachedServiceTokenExpiresAt = 0;

function clean(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function corsHeaders(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  const origin = request.headers.get("Origin") || "";
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

function bearer(request) {
  const auth = request.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function decodeFirebaseClaims(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const normalised = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function documentId(document) {
  return clean(String(document?.name || "").split("/").pop(), 200);
}

function fieldString(document, key) {
  return document?.fields?.[key]?.stringValue || "";
}

function fieldBoolean(document, key) {
  return document?.fields?.[key]?.booleanValue === true;
}

function fieldStringArray(document, key) {
  const values = document?.fields?.[key]?.arrayValue?.values;
  if (!Array.isArray(values)) return [];
  return values.map((value) => value?.stringValue || "").filter(Boolean);
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function textBase64Url(text) {
  return base64Url(new TextEncoder().encode(text));
}

async function importServicePrivateKey(pem) {
  const normalised = String(pem || "").replaceAll("\\n", "\n").trim();
  const body = normalised
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("Firebase service-account private key is not configured.");
  const binary = atob(body);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function serviceAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedServiceToken && cachedServiceTokenExpiresAt - 60 > now) return cachedServiceToken;

  const email = clean(env.FIREBASE_SERVICE_ACCOUNT_EMAIL, 320);
  if (!email || !env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error("Firebase service-account credentials are not configured.");
  }

  const header = textBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = textBase64Url(JSON.stringify({
    iss: email,
    sub: email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/datastore",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const key = await importServicePrivateKey(env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!response.ok) throw new Error(`Firebase service-account token request failed with ${response.status}.`);
  const body = await response.json();
  cachedServiceToken = clean(body.access_token, 4096);
  cachedServiceTokenExpiresAt = now + Number(body.expires_in || 3600);
  if (!cachedServiceToken) throw new Error("Firebase service-account token response was incomplete.");
  return cachedServiceToken;
}

function firestoreBase(env) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
}

async function getDocumentWithToken(env, token, collection, id) {
  if (!token || !id) return null;
  const response = await fetch(`${firestoreBase(env)}/${collection}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.ok ? response.json() : null;
}

async function listDocumentsWithToken(env, token, collection) {
  const result = [];
  let pageToken = "";
  do {
    const url = new URL(`${firestoreBase(env)}/${collection}`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Firestore list ${collection} failed with ${response.status}.`);
    const data = await response.json();
    if (Array.isArray(data.documents)) result.push(...data.documents);
    pageToken = clean(data.nextPageToken, 1000);
  } while (pageToken && result.length < 1000);
  return result;
}

async function privilegedDocument(env, collection, id) {
  return getDocumentWithToken(env, await serviceAccessToken(env), collection, id);
}

async function privilegedDocuments(env, collection) {
  return listDocumentsWithToken(env, await serviceAccessToken(env), collection);
}

function validEmail(value) {
  const email = clean(value, 254).toLowerCase();
  return /^[^\\s@,;]+@[^\\s@,;]+\\.[^\\s@,;]+$/.test(email) ? email : "";
}

function plainTextFromHtml(html) {
  return String(html || "")
    .replace(/<br[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#039;/gi, "'")
    .replace(/&quot;/gi, String.fromCharCode(34))
    .replace(/ +/g, " ")
    .trim();
}

async function sendEmail(env, to, subject, html, idempotencyKey = "") {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");
  const intended = [...new Set((Array.isArray(to) ? to : [to]).map(validEmail).filter(Boolean))];
  if (!intended.length) return { sent: 0 };

  const redirect = validEmail(env.TEST_EMAIL_REDIRECT);
  const recipients = redirect ? [redirect] : intended;
  const finalSubject = redirect ? `[TEST for ${intended.join(", ")}] ${subject}` : subject;
  const headers = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json"
  };
  if (idempotencyKey) headers["Idempotency-Key"] = clean(idempotencyKey, 256);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      ...(validEmail(env.EMAIL_REPLY_TO) ? { reply_to: validEmail(env.EMAIL_REPLY_TO) } : {}),
      to: recipients,
      subject: finalSubject,
      text: plainTextFromHtml(html),
      html
    })
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}.`);
  const provider = await response.json().catch(() => ({}));
  return { sent: intended.length, state: "accepted", providerRef: clean(provider?.id, 200) };
}

function brandedEmail({ heading, intro, bodyHtml = "", actions = [] }) {
  const actionHtml = actions
    .filter((action) => action?.label && action?.url)
    .map((action, index) => `<p style="margin:${index === 0 ? 28 : 12}px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${index === 0 ? BRAND.coral : BRAND.navy};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px">${escapeHtml(action.label)}</a></p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:${BRAND.background};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:${BRAND.background}"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:10px;overflow:hidden"><tr><td style="padding:28px;background:${BRAND.navy};color:#fff;text-align:center"><div style="font-size:24px;font-weight:800">${BRAND.groupName}</div><div style="font-size:14px;margin-top:6px;opacity:.92">Scout Group Communications</div></td></tr><tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:26px;color:${BRAND.navy}">${escapeHtml(heading)}</h1><p style="font-size:16px;line-height:1.6;margin:0 0 16px">${escapeHtml(intro)}</p>${bodyHtml}${actionHtml}</td></tr><tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;color:${BRAND.muted};font-size:12px;line-height:1.5">This message was sent by the Coolock Ardlea Scout Group website. Protected information is only available after sign-in.</td></tr></table></td></tr></table></body></html>`;
}

export function resolveParentRecipientCandidates(accounts, memberId, familyMemberIds = []) {
  const eligibleMemberIds = new Set([memberId, ...familyMemberIds].filter(Boolean));
  const linked = accounts.filter((account) => fieldStringArray(account, "memberIds").some((id) => eligibleMemberIds.has(id)));
  const approved = linked.filter((account) => fieldString(account, "status") === "approved");
  const recipients = approved.flatMap((account) => {
    const email = validEmail(fieldString(account, "email"));
    if (!email) return [];
    return [{ uid: documentId(account), email, displayName: fieldString(account, "displayName") || "Parent / Guardian" }];
  });
  const byEmail = new Map();
  for (const recipient of recipients) if (!byEmail.has(recipient.email)) byEmail.set(recipient.email, recipient);
  const unique = [...byEmail.values()];
  const reason = unique.length > 0
    ? ""
    : linked.length === 0
      ? "no-eligible-linked-parent"
      : approved.length === 0
        ? "parent-inactive"
        : "email-missing-or-invalid";
  return { recipients: unique, reason };
}

async function authoritativeParentRecipients(env, memberId) {
  const [accounts, selectedMember] = await Promise.all([
    privilegedDocuments(env, "parentAccounts"),
    privilegedDocument(env, "members", memberId)
  ]);
  const familyId = fieldString(selectedMember, "familyId");
  if (!familyId) return resolveParentRecipientCandidates(accounts, memberId);

  const members = await privilegedDocuments(env, "members");
  const familyMemberIds = members
    .filter((member) => fieldString(member, "familyId") === familyId)
    .map(documentId)
    .filter(Boolean);
  return resolveParentRecipientCandidates(accounts, memberId, familyMemberIds);
}

async function authenticatedLeaderMember(request, env, memberId) {
  const token = bearer(request);
  const claims = decodeFirebaseClaims(token);
  const uid = clean(claims.user_id || claims.sub, 200);
  if (!token || !uid) return null;
  const leader = await getDocumentWithToken(env, token, "adminUsers", uid);
  if (!leader || !fieldBoolean(leader, "active")) return null;
  if (!new Set(["leader", "admin", "super-admin"]).has(fieldString(leader, "role"))) return null;
  const member = await getDocumentWithToken(env, token, "members", memberId);
  if (!member) return null;
  return { token, uid, email: validEmail(claims.email), leader, member };
}

async function authenticatedParentMember(request, env, memberId) {
  const token = bearer(request);
  const claims = decodeFirebaseClaims(token);
  const uid = clean(claims.user_id || claims.sub, 200);
  if (!token || !uid) return null;
  const account = await getDocumentWithToken(env, token, "parentAccounts", uid);
  if (!account || fieldString(account, "status") !== "approved" || !fieldStringArray(account, "memberIds").includes(memberId)) return null;
  const member = await getDocumentWithToken(env, token, "members", memberId);
  if (!member) return null;
  return { token, uid, email: validEmail(claims.email), account, member };
}

function memberActionUrl(env, memberId) {
  return `${String(env.SITE_URL || "").replace(/\/$/, "")}/parent/member/${encodeURIComponent(memberId)}/inactivate`;
}

function parentPortalUrl(env) {
  return `${String(env.SITE_URL || "").replace(/\/$/, "")}/parent`;
}

async function communicationIdempotencyKey(memberId, recipientUid, subject, message) {
  const payload = `${memberId}\n${recipientUid}\n${subject}\n${message}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return `leader-communication:${base64Url(new Uint8Array(digest))}`;
}

async function handleLeaderCommunication(request, env, body) {
  const subject = clean(body.subject, 120);
  const message = clean(body.message, 2500);
  const memberIds = Array.isArray(body.memberIds)
    ? [...new Set(body.memberIds.map((value) => clean(value, 100)).filter(Boolean))].slice(0, 100)
    : [];
  if (!subject || !message || !memberIds.length) return json(request, env, 400, { ok: false, error: "Recipients, subject and message are required." });

  let sent = 0;
  let skipped = 0;
  const skippedReasons = {};
  const delivered = new Set();
  const skip = (reason) => {
    skipped += 1;
    skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
  };
  for (const memberId of memberIds) {
    const authorised = await authenticatedLeaderMember(request, env, memberId);
    if (!authorised) { skip("sender-not-authorised"); continue; }
    if (fieldString(authorised.member, "status") !== "active") { skip("member-inactive"); continue; }
    const resolution = await authoritativeParentRecipients(env, memberId);
    if (!resolution.recipients.length) { skip(resolution.reason || "no-eligible-linked-parent"); continue; }
    const memberName = fieldString(authorised.member, "displayName") || "your linked member";
    const messageHtml = escapeHtml(message).replaceAll("\n", "<br/>");
    let deliveredForMember = false;
    for (const recipient of resolution.recipients) {
      if (delivered.has(recipient.email)) continue;
      const idempotencyKey = await communicationIdempotencyKey(memberId, recipient.uid, subject, message);
      await sendEmail(env, recipient.email, subject, brandedEmail({
        heading: subject,
        intro: `Hello ${recipient.displayName},`,
        bodyHtml: `<p style="font-size:16px;line-height:1.7">${messageHtml}</p><p style="font-size:14px;line-height:1.6;color:${BRAND.muted};margin-top:22px">This message relates to <strong>${escapeHtml(memberName)}</strong>.</p>`,
        actions: [
          { label: "Open Parent Portal", url: parentPortalUrl(env) },
          { label: `${memberName} is no longer active`, url: memberActionUrl(env, memberId) }
        ]
      }), idempotencyKey);
      delivered.add(recipient.email);
      deliveredForMember = true;
      sent += 1;
    }
    if (!deliveredForMember) skip("duplicate-recipient");
  }
  return json(request, env, 200, { ok: true, sent, accepted: sent, deliveryState: "accepted", skipped, skippedReasons });
}

async function handleEventNotification(request, env, body) {
  const eventId = clean(body.eventId, 100);
  const consentToken = clean(body.consentToken, 100);
  const kind = body.kind === "update" || body.kind === "reminder" ? body.kind : "notice";
  const memberIds = Array.isArray(body.memberIds)
    ? [...new Set(body.memberIds.map((value) => clean(value, 100)).filter(Boolean))].slice(0, 200)
    : [];
  if (!eventId || !consentToken || !memberIds.length) return json(request, env, 400, { ok: false, error: "Event, consent link and members are required." });

  const first = await authenticatedLeaderMember(request, env, memberIds[0]);
  if (!first) return json(request, env, 403, { ok: false, error: "Active leader access required." });
  const event = await getDocumentWithToken(env, first.token, "events", eventId);
  const link = await getDocumentWithToken(env, first.token, "eventConsentLinks", consentToken);
  if (!event || fieldString(event, "status") !== "open") return json(request, env, 409, { ok: false, error: "An open event is required." });
  if (!link || fieldString(link, "eventId") !== eventId || !fieldBoolean(link, "active")) return json(request, env, 409, { ok: false, error: "An active consent link for this event is required." });

  const title = fieldString(event, "title") || "Scout event";
  const actionUrl = `${String(env.SITE_URL || "").replace(/\/$/, "")}/event-consent/${encodeURIComponent(consentToken)}`;
  let sent = 0;
  let skipped = 0;
  for (const memberId of memberIds) {
    const authorised = await authenticatedLeaderMember(request, env, memberId);
    if (!authorised || fieldString(authorised.member, "status") !== "active") { skipped += 1; continue; }
    const recipients = await authoritativeParentRecipients(env, memberId);
    if (!recipients.length) { skipped += 1; continue; }
    const memberName = fieldString(authorised.member, "displayName") || "your linked member";
    const heading = kind === "reminder" ? "Consent reminder" : kind === "update" ? "Event update" : "New event notice";
    const subject = kind === "reminder" ? `Consent reminder – ${title}` : kind === "update" ? `Event update – ${title}` : `New event – ${title}`;
    for (const recipient of recipients) {
      await sendEmail(env, recipient.email, subject, brandedEmail({
        heading,
        intro: `Hello ${recipient.displayName}, this message relates to ${memberName}.`,
        bodyHtml: `<p style="font-size:16px;line-height:1.6">Please open the secure portal to review the event and respond. Protected or sensitive details are not included in this email.</p>`,
        actions: [
          { label: "Respond to event", url: actionUrl },
          { label: "Open Parent Portal", url: parentPortalUrl(env) },
          { label: `${memberName} is no longer active`, url: memberActionUrl(env, memberId) }
        ]
      }), `event:${eventId}:${kind}:${memberId}:${recipient.uid}`);
      sent += 1;
    }
  }
  return json(request, env, 200, { ok: true, sent, skipped });
}

async function handleEventConsentProcessed(request, env, body) {
  const eventId = clean(body.eventId, 100);
  const memberId = clean(body.memberId, 100);
  if (!eventId || !memberId) return json(request, env, 400, { ok: false, error: "Event and member are required." });
  const authorised = await authenticatedLeaderMember(request, env, memberId);
  if (!authorised) return json(request, env, 403, { ok: false, error: "Active leader access required." });
  if (fieldString(authorised.member, "status") !== "active") return json(request, env, 200, { ok: true, skipped: true });
  const event = await getDocumentWithToken(env, authorised.token, "events", eventId);
  if (!event) return json(request, env, 403, { ok: false, error: "Event unavailable for this leader." });
  const recipients = await authoritativeParentRecipients(env, memberId);
  if (!recipients.length) return json(request, env, 200, { ok: true, skipped: true });
  const memberName = fieldString(authorised.member, "displayName") || "your linked member";
  const title = fieldString(event, "title") || "Scout event";
  for (const recipient of recipients) {
    await sendEmail(env, recipient.email, `Event response confirmed – ${title}`, brandedEmail({
      heading: "Event response confirmed",
      intro: `Hello ${recipient.displayName}, the event response for ${memberName} has been recorded.`,
      bodyHtml: `<p style="font-size:16px;line-height:1.6">Open the secure Parent Portal to review the current event status.</p>`,
      actions: [
        { label: "Open Parent Portal", url: parentPortalUrl(env) },
        { label: `${memberName} is no longer active`, url: memberActionUrl(env, memberId) }
      ]
    }), `event-processed:${eventId}:${memberId}:${recipient.uid}`);
  }
  return json(request, env, 200, { ok: true, sent: recipients.length });
}

async function persistReminderState(env, id, record, existing = null) {
  const token = await serviceAccessToken(env);
  const url = `${firestoreBase(env)}/consentReminderDeliveries/${encodeURIComponent(id)}`;
  const fields = Object.fromEntries(Object.entries(record).map(([key, value]) =>
    typeof value === "number" ? [key, { integerValue: String(value) }] : [key, { stringValue: String(value) }]
  ));
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!response.ok) throw new Error(`Reminder persistence failed with ${response.status}.`);
  return response.json();
}

async function handleFormReminder(request, env, body) {
  const memberIds = Array.isArray(body.memberIds)
    ? [...new Set(body.memberIds.map((value) => clean(value, 100)).filter(Boolean))].slice(0, 100)
    : [];
  const cycleKey = clean(body.reminderKey, 500) || "missing:unknown";
  const reason = cycleKey.startsWith("expired:") || cycleKey.startsWith("annual:") ? "expired" : "missing";
  if (!memberIds.length) return json(request, env, 400, { ok: false, error: "Members are required." });
  let sent = 0;
  let skipped = 0;
  for (const memberId of memberIds) {
    const authorised = await authenticatedLeaderMember(request, env, memberId);
    if (!authorised || fieldString(authorised.member, "status") !== "active") { skipped += 1; continue; }
    const recipients = await authoritativeParentRecipients(env, memberId);
    if (!recipients.length) { skipped += 1; continue; }
    const memberName = fieldString(authorised.member, "displayName") || "your linked member";
    for (const recipient of recipients) {
      const id = reminderDocumentId({ memberId, recipientUid: recipient.uid, cycleKey });
      const existing = await privilegedDocument(env, "consentReminderDeliveries", id);
      const existingStatus = fieldString(existing, "status");
      if (!shouldAttemptReminder(existing ? { status: existingStatus } : null)) { skipped += 1; continue; }
      const previousAttempts = Number(existing?.fields?.attemptCount?.integerValue || 0);
      const attemptCount = previousAttempts + 1;
      await persistReminderState(env, id, reminderRecord({ memberId, recipientUid: recipient.uid, cycleKey, reason, status: "sending", attemptCount }), existing);
      try {
        await sendEmail(env, recipient.email, "Parent Portal information requires attention – Coolock Ardlea Scouts", brandedEmail({
          heading: "Information requires attention",
          intro: `Hello ${recipient.displayName}, information for ${memberName} in the Parent Portal needs to be reviewed or renewed.`,
          bodyHtml: `<p style="font-size:16px;line-height:1.6">For privacy, this email does not include medical, consent or other sensitive details. Sign in to the Parent Portal to see what needs attention.</p>`,
          actions: [
            { label: "Open Parent Portal", url: parentPortalUrl(env) },
            { label: `${memberName} is no longer active`, url: memberActionUrl(env, memberId) }
          ]
        }), `form-reminder:${id}`);
        await persistReminderState(env, id, reminderRecord({ memberId, recipientUid: recipient.uid, cycleKey, reason, status: "sent", attemptCount }));
        sent += 1;
      } catch (error) {
        await persistReminderState(env, id, reminderRecord({ memberId, recipientUid: recipient.uid, cycleKey, reason, status: "failed", attemptCount }));
        throw error;
      }
    }
  }
  return json(request, env, 200, { ok: true, sent, skipped });
}

async function handleMemberInactivationContext(request, env, body) {
  const memberId = clean(body.memberId, 100);
  if (!memberId) return json(request, env, 400, { ok: false, error: "Member is required." });
  const parent = await authenticatedParentMember(request, env, memberId);
  const leader = parent ? null : await authenticatedLeaderMember(request, env, memberId);
  const authorised = parent || leader;
  if (!authorised) return json(request, env, 403, { ok: false, error: "You are not authorised to manage this member." });
  return json(request, env, 200, {
    ok: true,
    member: {
      id: memberId,
      displayName: fieldString(authorised.member, "displayName"),
      section: fieldString(authorised.member, "section"),
      status: fieldString(authorised.member, "status")
    }
  });
}

function documentName(env, collection, id) {
  return `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${id}`;
}

function stringField(value) {
  return { stringValue: String(value ?? "") };
}

async function linkedApprovedParents(env, memberId) {
  return (await privilegedDocuments(env, "parentAccounts")).filter((account) =>
    fieldString(account, "status") === "approved" && fieldStringArray(account, "memberIds").includes(memberId)
  );
}

async function shouldRevokeParent(env, parent, changedMemberId) {
  for (const otherId of fieldStringArray(parent, "memberIds")) {
    if (otherId === changedMemberId) continue;
    const member = await privilegedDocument(env, "members", otherId);
    if (member && fieldString(member, "status") === "active") return false;
  }
  return true;
}

async function leadershipRecipients(env, section) {
  const [profiles, leadership] = await Promise.all([
    privilegedDocuments(env, "adminUsers"),
    privilegedDocuments(env, "organisationLeadership")
  ]);
  const leadershipByUid = new Map(leadership.map((item) => [documentId(item), item]));
  const recipients = [];
  for (const profile of profiles) {
    if (!fieldBoolean(profile, "active")) continue;
    const uid = documentId(profile);
    const role = fieldString(profile, "role");
    const sections = fieldStringArray(profile, "sections");
    const organisation = leadershipByUid.get(uid);
    const appointment = organisation && fieldBoolean(organisation, "active") ? fieldString(organisation, "scoutingRole") : "";
    const sectionLeader = sections.includes(section);
    const groupLeader = new Set(["Group Leader", "Deputy Group Leader", "Deputy-Group-Leader", "DGL"]).has(appointment);
    const administrator = role === "admin" || role === "super-admin";
    if (!sectionLeader && !groupLeader && !administrator) continue;
    const email = validEmail(fieldString(profile, "email"));
    if (email) recipients.push(email);
  }
  return [...new Set(recipients)];
}

async function commitMemberInactivation(env, actor, memberId, member, parentAccounts) {
  const serviceToken = await serviceAccessToken(env);
  const historyId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const section = fieldString(member, "section");
  const memberName = fieldString(member, "displayName") || "Member";
  const writes = [
    {
      update: {
        name: documentName(env, "members", memberId),
        fields: { status: stringField("inactive"), updatedBy: stringField(actor.uid) }
      },
      updateMask: { fieldPaths: ["status", "updatedBy"] },
      updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { updateTime: member.updateTime }
    },
    {
      update: {
        name: documentName(env, "memberHistory", historyId),
        fields: {
          memberId: stringField(memberId),
          memberName: stringField(memberName),
          changeType: stringField("status-change"),
          fromSection: stringField(section),
          toSection: stringField(section),
          fromStatus: stringField("active"),
          toStatus: stringField("inactive"),
          changedBy: stringField(actor.uid)
        }
      },
      updateTransforms: [{ fieldPath: "changedAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false }
    },
    {
      update: {
        name: documentName(env, "auditLog", auditId),
        fields: {
          category: stringField("member"),
          action: stringField("Member marked inactive from secure portal link"),
          actorUid: stringField(actor.uid),
          actorEmail: stringField(actor.email),
          targetId: stringField(memberId),
          targetLabel: stringField(memberName),
          description: stringField("Member status changed from active to inactive after authenticated confirmation."),
          section: stringField(section)
        }
      },
      updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false }
    }
  ];

  for (const parent of parentAccounts) {
    if (!(await shouldRevokeParent(env, parent, memberId))) continue;
    writes.push({
      update: {
        name: documentName(env, "parentAccounts", documentId(parent)),
        fields: { status: stringField("revoked") }
      },
      updateMask: { fieldPaths: ["status"] },
      updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { updateTime: parent.updateTime }
    });
  }

  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ writes })
  });
  if (!response.ok) {
    if (response.status === 409 || response.status === 412) return { stale: true };
    throw new Error(`Firestore lifecycle commit failed with ${response.status}.`);
  }
  return { stale: false };
}

async function handleMemberInactivation(request, env, body) {
  const memberId = clean(body.memberId, 100);
  if (!memberId || body.confirm !== true) return json(request, env, 400, { ok: false, error: "Explicit confirmation is required." });
  const parent = await authenticatedParentMember(request, env, memberId);
  const leader = parent ? null : await authenticatedLeaderMember(request, env, memberId);
  const authorised = parent || leader;
  if (!authorised) return json(request, env, 403, { ok: false, error: "You are not authorised to manage this member." });

  const current = await privilegedDocument(env, "members", memberId);
  if (!current) return json(request, env, 404, { ok: false, error: "Member not found." });
  const currentStatus = fieldString(current, "status");
  if (currentStatus !== "active") return json(request, env, 200, { ok: true, alreadyInactive: true, status: currentStatus });

  const parents = await linkedApprovedParents(env, memberId);
  const actor = { uid: authorised.uid, email: authorised.email || "" };
  const committed = await commitMemberInactivation(env, actor, memberId, current, parents);
  if (committed.stale) return json(request, env, 409, { ok: false, error: "Member status changed while this page was open. Refresh and try again." });

  const section = fieldString(current, "section");
  const memberName = fieldString(current, "displayName") || "Member";
  const leaders = await leadershipRecipients(env, section);
  for (const email of leaders) {
    await sendEmail(env, email, `Member marked inactive – ${memberName}`, brandedEmail({
      heading: "Member marked inactive",
      intro: `${memberName} has been marked inactive through an authenticated portal confirmation.`,
      bodyHtml: `<p style="font-size:16px;line-height:1.6">Section: <strong>${escapeHtml(section || "Not recorded")}</strong>. Review Member Management if any follow-up is required.</p>`,
      actions: [{ label: "Open Member Management", url: `${String(env.SITE_URL || "").replace(/\/$/, "")}/leader/members/${encodeURIComponent(memberId)}` }]
    }), `member-inactive-leader:${memberId}:${email}`);
  }

  return json(request, env, 200, { ok: true, alreadyInactive: false, status: "inactive" });
}

export async function handleProductionRoute(request, env, body, path) {
  if (path === "/leader-communication") return handleLeaderCommunication(request, env, body);
  if (path === "/event-notification") return handleEventNotification(request, env, body);
  if (path === "/event-consent-processed") return handleEventConsentProcessed(request, env, body);
  if (path === "/form-reminder") return handleFormReminder(request, env, body);
  if (path === "/member-inactivation-context") return handleMemberInactivationContext(request, env, body);
  if (path === "/member-inactivation") return handleMemberInactivation(request, env, body);
  return null;
}
