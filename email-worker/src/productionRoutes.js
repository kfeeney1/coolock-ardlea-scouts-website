import { issueMemberInactivationToken, verifyJoinConsentToken, verifyMemberInactivationToken } from "./secureActionLinks.js";
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

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
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

const SECTION_SCOPED_EVENT_APPOINTMENTS = new Set([
  "Section Leader",
  "Assistant Section Leader",
  "Programme Scouter",
  "Scouter"
]);

function authorisedEventAppointmentSections(leadership) {
  const appointments = fieldMapArray(leadership, "appointments");
  const activeSections = appointments
    .filter((appointment) => appointment.active?.booleanValue !== false)
    .filter((appointment) => SECTION_SCOPED_EVENT_APPOINTMENTS.has(appointment.appointment?.stringValue || ""))
    .map((appointment) => canonicalAudienceSection(appointment.scope?.stringValue || ""))
    .filter(Boolean);
  if (activeSections.length || appointments.length) return activeSections;

  // Legacy records predate the appointments array and store one active role/scope.
  const legacyRole = fieldString(leadership, "scoutingRole");
  const legacySection = fieldString(leadership, "organisationSection");
  return SECTION_SCOPED_EVENT_APPOINTMENTS.has(legacyRole)
    ? [canonicalAudienceSection(legacySection)].filter(Boolean)
    : [];
}

function fieldMapArray(document, key) {
  const values = document?.fields?.[key]?.arrayValue?.values;
  return Array.isArray(values) ? values.map((value) => value?.mapValue?.fields || {}).filter(Boolean) : [];
}

function fieldMapString(fields, key) {
  return fields?.[key]?.stringValue || "";
}

function fieldMapBoolean(fields, key) {
  return fields?.[key]?.booleanValue === true;
}

function activeAppointment(appointment) {
  if (!fieldMapBoolean(appointment, "active")) return false;
  const today = new Date().toISOString().slice(0, 10);
  const start = fieldMapString(appointment, "startDate");
  const end = fieldMapString(appointment, "endDate");
  return (!start || start <= today) && (!end || end >= today);
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

export async function serviceAccessToken(env) {
  // Firebase runtimes supply a short-lived ADC token; Workers retain secret-based auth.
  if (typeof env.getServiceAccessToken === "function") return env.getServiceAccessToken();
  if (clean(env.FIRESTORE_EMULATOR_HOST, 200)) return "owner";
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
  const emulatorHost = clean(env.FIRESTORE_EMULATOR_HOST, 200);
  if (emulatorHost) return `http://${emulatorHost.replace(/^https?:\/\//, "")}/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
}

async function getDocumentWithToken(env, token, collection, id) {
  if (!token || !id) return null;
  const response = await fetch(`${firestoreBase(env)}/${collection}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.ok ? response.json() : null;
}

export function isEventAudienceMember(event, eventId, memberId, membership) {
  const audienceVersion = event?.fields?.audience?.mapValue?.fields?.version?.integerValue;
  if (audienceVersion !== "3") return true;
  return fieldString(membership, "eventId") === eventId && fieldString(membership, "memberId") === memberId;
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

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value)
    ? { integerValue: String(value) }
    : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)])) } };
  return { nullValue: null };
}

function documentFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]));
}

function firestoreMap(document, key) {
  const fields = document?.fields?.[key]?.mapValue?.fields || {};
  return Object.fromEntries(Object.entries(fields).map(([entryKey, value]) => {
    if (typeof value.stringValue === "string") return [entryKey, value.stringValue];
    if (typeof value.booleanValue === "boolean") return [entryKey, value.booleanValue];
    if (value.integerValue !== undefined) return [entryKey, Number(value.integerValue)];
    return [entryKey, null];
  }));
}

function sameRecord(left, right) {
  const stable = (value) => JSON.stringify(Object.fromEntries(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b))));
  return stable(left) === stable(right);
}

function canonicalAudienceSection(value) {
  const section = clean(value, 80).toLowerCase().replace(/\s+/g, " ");
  if (["beaver", "beavers", "beaver scout", "beaver scouts"].includes(section)) return "Beavers";
  if (["cub", "cubs", "cub scout", "cub scouts"].includes(section)) return "Cubs";
  if (["scout", "scouts", "scout troop"].includes(section)) return "Scouts";
  if (["venture", "ventures", "venture scout", "venture scouts"].includes(section)) return "Ventures";
  if (["rover", "rovers", "rover scout", "rover scouts"].includes(section)) return "Rovers";
  return "";
}

function memberHasAudienceSection(member, section) {
  const sections = fieldStringArray(member, "sections");
  const legacySection = fieldString(member, "section");
  return [...sections, legacySection].some((value) => canonicalAudienceSection(value) === section);
}

async function commitEventAudience(env, writes) {
  const token = await serviceAccessToken(env);
  const response = await fetch(`${firestoreBase(env)}:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ writes })
  });
  if (!response.ok) throw new Error(`Event audience commit failed with ${response.status}.`);
  return response.json();
}

async function eventAudienceAuditId(eventId, operation, event, memberIds, removedIds) {
  const stableEvent = { ...event };
  delete stableEvent.updatedAt;
  delete stableEvent.updatedBy;
  const content = JSON.stringify({ eventId, operation, event: stableEvent, memberIds: [...memberIds].sort(), removedIds: [...removedIds].sort() });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `event-${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}

export async function handleEventAudienceSave(request, env, body) {
  const idToken = bearer(request);
  const claims = decodeFirebaseClaims(idToken);
  const uid = clean(claims.user_id || claims.sub, 200);
  if (!idToken || !uid) return json(request, env, 401, { ok: false, error: "Sign-in required." });
  const leader = await getDocumentWithToken(env, idToken, "adminUsers", uid);
  if (!leader || !fieldBoolean(leader, "active") || !new Set(["leader", "admin", "super-admin"]).has(fieldString(leader, "role"))) {
    return json(request, env, 403, { ok: false, error: "Active leader access required." });
  }
  const leadership = await getDocumentWithToken(env, idToken, "organisationLeadership", uid);

  const input = body.input && typeof body.input === "object" ? body.input : {};
  const rawAudience = body.audience && typeof body.audience === "object" ? body.audience : {};
  const eventId = clean(body.eventId, 100);
  const operation = body.operation === "update" ? "update" : "create";
  if (!eventId || !clean(input.title, 200) || !clean(input.section, 80)) {
    return json(request, env, 400, { ok: false, error: "Event details are incomplete." });
  }
  const startDate = clean(input.startDate, 30);
  const endDate = clean(input.endDate, 30);
  if (!clean(input.eventType, 80) || !validIsoDate(startDate) || !validIsoDate(endDate) || endDate < startDate) {
    return json(request, env, 400, { ok: false, error: "Event type and a valid date range are required." });
  }

  const isAdmin = ["admin", "super-admin"].includes(fieldString(leader, "role"));
  const authorisedSections = isAdmin
    ? ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]
    : [...new Set([
      ...fieldStringArray(leader, "sections").map(canonicalAudienceSection),
      ...authorisedEventAppointmentSections(leadership)
    ].filter(Boolean))];
  const sectionIds = [...new Set((Array.isArray(rawAudience.sectionIds) ? rawAudience.sectionIds : []).map(canonicalAudienceSection).filter(Boolean))];
  const memberIds = [...new Set((Array.isArray(rawAudience.memberIds) ? rawAudience.memberIds : []).map((value) => clean(value, 100)).filter(Boolean))];
  if ((!isAdmin && sectionIds.some((section) => !authorisedSections.includes(section)))
      || (!isAdmin && !authorisedSections.includes(canonicalAudienceSection(input.section)) && clean(input.section, 80) !== "All Sections")) {
    return json(request, env, 403, { ok: false, error: "The audience contains a section outside your authorised scope." });
  }
  if (!isAdmin && clean(input.section, 80) === "All Sections") return json(request, env, 403, { ok: false, error: "Only an administrator can classify an event as Group wide." });

  const token = await serviceAccessToken(env);
  const [memberDocuments, currentEvent, updateMembershipDocuments] = await Promise.all([
    privilegedDocuments(env, "members"),
    privilegedDocument(env, "events", eventId),
    operation === "update" ? listDocumentsWithToken(env, token, `events/${encodeURIComponent(eventId)}/audienceMembers`) : Promise.resolve([])
  ]);
  if (operation === "update" && !currentEvent) return json(request, env, 404, { ok: false, error: "Event not found." });
  let currentMembershipDocuments = updateMembershipDocuments;
  if (operation === "create" && currentEvent) {
    currentMembershipDocuments = await listDocumentsWithToken(env, token, `events/${encodeURIComponent(eventId)}/audienceMembers`);
  }
  if (operation === "update" && !isAdmin
      && !authorisedSections.includes(canonicalAudienceSection(fieldString(currentEvent, "section")))) {
    return json(request, env, 403, { ok: false, error: "This event is outside your authorised section scope." });
  }
  // The commit below leases currentEvent.updateTime: a concurrent hall reserve/release
  // invalidates this decision rather than allowing a stale schedule through.
  if (operation === "update" && fieldString(currentEvent, "hallResource") === "group-hall"
      && ["startDate", "endDate", "section"].some(key => fieldString(currentEvent, key) !== clean(input[key], key === "section" ? 80 : 30))) {
    return json(request, env, 409, {ok: false, error: "Release the event's hall reservation before changing its dates or section."});
  }
  const currentAudienceVersion = currentEvent?.fields?.audience?.mapValue?.fields?.version?.integerValue;
  const keepLegacyAudience = operation === "update" && body.preserveLegacyAudience === true && currentAudienceVersion !== "3";

  const membersById = new Map(memberDocuments.map((member) => [documentId(member), member]));
  const effectiveIds = new Set();
  for (const member of keepLegacyAudience ? [] : memberDocuments) {
    if (fieldString(member, "status") !== "active") continue;
    if (sectionIds.some((section) => memberHasAudienceSection(member, section))) effectiveIds.add(documentId(member));
  }
  for (const memberId of keepLegacyAudience ? [] : memberIds) {
    const member = membersById.get(memberId);
    if (!member || fieldString(member, "status") !== "active") return json(request, env, 409, { ok: false, error: "A selected member is no longer active. Refresh the audience and try again." });
    if (!isAdmin && !authorisedSections.some((section) => memberHasAudienceSection(member, section))) {
      return json(request, env, 403, { ok: false, error: "A selected member is outside your authorised scope." });
    }
    effectiveIds.add(memberId);
  }
  if (effectiveIds.size === 0 && !keepLegacyAudience) return json(request, env, 400, { ok: false, error: "Choose at least one active member." });
  if (effectiveIds.size > 450) return json(request, env, 400, { ok: false, error: "The event audience cannot exceed 450 active members." });

  const currentRows = new Map(currentMembershipDocuments.map((membership) => [documentId(membership), membership]));
  const retainedHiddenIds = operation === "update" && !keepLegacyAudience
    ? [...currentRows.keys()].filter((id) => {
      const member = membersById.get(id);
      return member && !authorisedSections.some((section) => memberHasAudienceSection(member, section));
    })
    : [];
  retainedHiddenIds.forEach((id) => effectiveIds.add(id));
  const priorIds = new Set(currentRows.keys());
  const additions = keepLegacyAudience ? [] : [...effectiveIds].filter((id) => !priorIds.has(id));
  const removals = keepLegacyAudience ? [] : [...priorIds].filter((id) => !effectiveIds.has(id));
  if (operation === "create" && currentEvent) {
    const existingAudience = currentEvent.fields?.audience?.mapValue?.fields || {};
    const existingSectionIds = (existingAudience.sectionIds?.arrayValue?.values || []).map((value) => value.stringValue || "").filter(Boolean);
    const existingIndividualIds = currentMembershipDocuments.filter((row) => fieldBoolean(row, "selectedIndividually")).map(documentId).sort();
    const requestedMemberIds = [...memberIds].sort();
    const sameAudience = [...currentRows.keys()].sort().join("|") === [...effectiveIds].sort().join("|")
      && existingSectionIds.sort().join("|") === [...sectionIds].sort().join("|")
      && existingIndividualIds.join("|") === requestedMemberIds.join("|");
    const sameEvent = fieldString(currentEvent, "createdBy") === uid
      && ["title", "description", "eventType", "section", "location", "meetingPoint", "returnDetails", "leaderNotes", "startDate", "endDate", "status"]
        .every((key) => fieldString(currentEvent, key) === clean(input[key], key === "description" || key === "leaderNotes" ? 3000 : 500))
      && fieldBoolean(currentEvent, "consentRequired") === (input.consentRequired === true)
      && existingAudience.version?.integerValue === "3";
    if (sameAudience && sameEvent) return json(request, env, 200, {
      ok: true, eventId, invitedCount: effectiveIds.size, newlyInvitedMemberIds: [], removedMemberIds: [], alreadyExists: true
    });
    return json(request, env, 409, { ok: false, error: "Event ID already exists with different saved details." });
  }
  if (removals.length && body.confirmRemovals !== true) return json(request, env, 409, { ok: false, error: "Confirm removal of existing invitees before saving." });
  const timestamp = new Date();
  const eventSection = clean(input.section, 80);
  const audience = {
    version: 3,
    mode: sectionIds.length && memberIds.length ? "mixed" : sectionIds.length ? "sections" : "members",
    semantics: "snapshot",
    sectionIds,
    memberIds: [],
    resolvedMemberIds: []
  };
  const previousAttendance = operation === "update" ? firestoreMap(currentEvent, "attendance") : {};
  const previousConsent = operation === "update" ? firestoreMap(currentEvent, "consent") : {};
  const attendance = { ...previousAttendance };
  const consent = { ...previousConsent };
  for (const id of effectiveIds) {
    attendance[id] ??= "invited";
    consent[id] ??= input.consentRequired === true ? "required" : "not-required";
  }
  const cleanInput = {
    title: clean(input.title, 200),
    description: clean(input.description, 3000),
    eventType: clean(input.eventType, 80),
    section: eventSection,
    location: clean(input.location, 300),
    meetingPoint: clean(input.meetingPoint, 500),
    returnDetails: clean(input.returnDetails, 500),
    leaderNotes: clean(input.leaderNotes, 3000),
    startDate: clean(input.startDate, 30),
    endDate: clean(input.endDate, 30),
    status: clean(input.status, 30),
    consentRequired: input.consentRequired === true,
    ...(!keepLegacyAudience ? { audience } : {}),
    attendance,
    consent,
    updatedAt: timestamp,
    updatedBy: uid
  };
  if (!["draft", "open", "closed", "completed"].includes(cleanInput.status)) return json(request, env, 400, { ok: false, error: "Event status is invalid." });
  if (operation === "create" && !["draft", "open"].includes(cleanInput.status)) return json(request, env, 400, { ok: false, error: "New events must start as Draft or Open." });
  if (operation === "update") {
    const currentStatus = fieldString(currentEvent, "status");
    const transitions = { draft: ["draft", "open"], open: ["open", "draft", "closed"], closed: ["closed", "open", "completed"], completed: ["completed"] };
    if (!transitions[currentStatus]?.includes(cleanInput.status)) return json(request, env, 409, { ok: false, error: "Event status cannot move directly from its current state." });
    if (cleanInput.status === "completed") {
      const attendanceValues = Object.values(previousAttendance);
      const consentValues = Object.values(previousConsent);
      if (currentStatus !== "closed" || attendanceValues.length === 0 || attendanceValues.some((value) => value === "invited")
          || (fieldBoolean(currentEvent, "consentRequired") && consentValues.some((value) => value === "required"))) {
        return json(request, env, 409, { ok: false, error: "Complete the attendance and consent close-out before completing this event." });
      }
    }
  }
  if (operation === "update") {
    const currentAudience = currentEvent.fields?.audience?.mapValue?.fields || {};
    const currentAudienceIds = [...currentRows.keys()].sort();
    const requestedAudienceIds = [...effectiveIds].sort();
    const currentIndividualIds = currentMembershipDocuments.filter((row) => fieldBoolean(row, "selectedIndividually")).map(documentId).sort();
    const currentSections = (currentAudience.sectionIds?.arrayValue?.values || []).map((value) => value.stringValue || "").filter(Boolean).sort();
    const sameAudience = currentAudienceIds.join("|") === requestedAudienceIds.join("|")
      && currentSections.join("|") === [...sectionIds].sort().join("|")
      && currentIndividualIds.join("|") === [...memberIds].sort().join("|")
      && (keepLegacyAudience || currentAudience.mode?.stringValue === audience.mode);
    const metadataFields = ["title", "description", "eventType", "section", "location", "meetingPoint", "returnDetails", "leaderNotes", "startDate", "endDate", "status"];
    const sameMetadata = metadataFields.every((key) => fieldString(currentEvent, key) === cleanInput[key])
      && fieldBoolean(currentEvent, "consentRequired") === cleanInput.consentRequired;
    const sameResponses = sameRecord(firestoreMap(currentEvent, "attendance"), attendance)
      && sameRecord(firestoreMap(currentEvent, "consent"), consent);
    if (sameAudience && sameMetadata && sameResponses) return json(request, env, 200, {
      ok: true, eventId, invitedCount: effectiveIds.size, newlyInvitedMemberIds: [], removedMemberIds: [], alreadyExists: true
    });
  }
  const path = `projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/events/${encodeURIComponent(eventId)}`;
  const writes = [];
  if (operation === "create") {
    writes.push({ update: { name: path, fields: documentFields({ ...cleanInput, createdAt: timestamp, createdBy: uid }) }, currentDocument: { exists: false } });
  } else {
    // Firestore stores updateTime separately from the user-managed updatedAt field.
    writes.push({ update: { name: path, fields: documentFields(cleanInput) }, updateMask: { fieldPaths: Object.keys(cleanInput) }, currentDocument: { updateTime: currentEvent.updateTime } });
    if (!currentEvent.updateTime) return json(request, env, 409, { ok: false, error: "Refresh this event before saving changes." });
  }
  const programme = Object.fromEntries(["title", "description", "eventType", "section", "location", "startDate", "endDate", "status"].map(key => [key, cleanInput[key]]));
  writes.push({update: {name: `${path}/programmes/parent`, fields: documentFields({eventId, ...programme})}});
  for (const id of effectiveIds) {
    if (retainedHiddenIds.includes(id)) {
      const row = currentRows.get(id);
      writes.push({update: {name: `${path}/audienceMembers/${encodeURIComponent(id)}`, fields: documentFields({startDate: cleanInput.startDate, endDate: cleanInput.endDate, programmeVisible: cleanInput.status !== "draft"})}, updateMask: {fieldPaths: ["startDate", "endDate", "programmeVisible"]}, currentDocument: row?.updateTime ? {updateTime: row.updateTime} : {exists: true}});
      continue;
    }
    const member = membersById.get(id);
    const matchingSection = sectionIds.find((section) => memberHasAudienceSection(member, section));
    const scopeSection = matchingSection || authorisedSections.find((section) => memberHasAudienceSection(member, section));
    if (!scopeSection) return json(request, env, 403, { ok: false, error: "A selected member is outside your authorised scope." });
    const membership = {
      eventId,
      eventSection,
      memberId: id,
      scopeSection,
      selectedBySection: Boolean(matchingSection),
      selectedIndividually: memberIds.includes(id),
      startDate: cleanInput.startDate, endDate: cleanInput.endDate, programmeVisible: cleanInput.status !== "draft",
      updatedAt: timestamp,
      updatedBy: uid
    };
    const membershipPath = `${path}/audienceMembers/${encodeURIComponent(id)}`;
    const existingRow = currentRows.get(id);
    writes.push({
      update: { name: membershipPath, fields: documentFields(membership) },
      currentDocument: existingRow?.updateTime ? { updateTime: existingRow.updateTime } : { exists: false }
    });
  }
  for (const memberId of removals) {
    const oldRow = currentRows.get(memberId);
    writes.push({ delete: `${path}/audienceMembers/${encodeURIComponent(memberId)}`, currentDocument: oldRow?.updateTime ? { updateTime: oldRow.updateTime } : undefined });
  }
  const auditId = await eventAudienceAuditId(eventId, operation, cleanInput, effectiveIds, removals);
  const auditDescription = operation === "create"
    ? `Created event with status ${cleanInput.status}${cleanInput.consentRequired ? "; consent required" : ""}; invited ${effectiveIds.size} members.`
    : `Updated event; status is ${cleanInput.status}${cleanInput.consentRequired ? "; consent required" : ""}; audience additions: ${additions.length}; audience removals: ${removals.length}.`;
  writes.push({ update: {
    name: `projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/auditLog/${encodeURIComponent(auditId)}`,
    fields: documentFields({
      category: "event",
      action: cleanInput.status === "completed" ? "Event completed" : operation === "create" ? "Event created" : "Event updated",
      actorUid: uid,
      actorEmail: validEmail(claims.email),
      targetId: eventId,
      targetLabel: cleanInput.title,
      description: auditDescription,
      section: eventSection,
      createdAt: timestamp
    })
  } });
  if (writes.length > 500) return json(request, env, 400, { ok: false, error: "This audience change is too large to save in one atomic operation." });
  try {
    await commitEventAudience(env, writes);
  } catch (error) {
    if (String(error?.message || "").includes("commit failed with 409")) return json(request, env, 409, { ok: false, error: "This event changed while you were editing. Refresh and review the audience again." });
    throw error;
  }
  return json(request, env, 200, { ok: true, eventId, invitedCount: effectiveIds.size, newlyInvitedMemberIds: additions, removedMemberIds: removals });
}

function validEmail(value) {
  const email = clean(value, 254).toLowerCase();
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) ? email : "";
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
    .map((action, index) => {
      const secondary = action.variant === "secondary";
      const style = secondary
        ? `display:inline-block;color:${BRAND.muted};text-decoration:underline;font-size:13px;padding:4px 0`
        : `display:inline-block;background:${index === 0 ? BRAND.coral : BRAND.navy};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px`;
      return `<p style="margin:${secondary ? 18 : index === 0 ? 28 : 12}px 0"><a href="${escapeHtml(action.url)}" style="${style}">${escapeHtml(action.label)}</a></p>`;
    })
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

async function memberActionUrl(env, memberId) {
  const token = await issueMemberInactivationToken(env, memberId);
  return `${String(env.SITE_URL || "").replace(/\/$/, "")}/parent/member-action/${encodeURIComponent(token)}`;
}

function parentPortalUrl(env) {
  return `${String(env.SITE_URL || "").replace(/\/$/, "")}/parent`;
}

export async function communicationIdempotencyKey(memberId, recipientUid, subject, message) {
  const payload = `${memberId}
${recipientUid}
${subject}
${message}`;
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
          { label: `Report ${memberName} as no longer active`, url: await memberActionUrl(env, memberId), variant: "secondary" }
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
  const selectedAudience = event.fields?.audience?.mapValue?.fields?.version?.integerValue === "3";

  const title = fieldString(event, "title") || "Scout event";
  const actionUrl = `${String(env.SITE_URL || "").replace(/\/$/, "")}/event-consent/${encodeURIComponent(consentToken)}`;
  let sent = 0;
  let skipped = 0;
  for (const memberId of memberIds) {
    const authorised = await authenticatedLeaderMember(request, env, memberId);
    if (!authorised || fieldString(authorised.member, "status") !== "active") { skipped += 1; continue; }
    if (selectedAudience) {
      const membership = await getDocumentWithToken(
        env,
        authorised.token,
        `events/${encodeURIComponent(eventId)}/audienceMembers`,
        memberId
      );
      if (!isEventAudienceMember(event, eventId, memberId, membership)) {
        skipped += 1;
        continue;
      }
    }
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
          { label: `Report ${memberName} as no longer active`, url: await memberActionUrl(env, memberId), variant: "secondary" }
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
        { label: `Report ${memberName} as no longer active`, url: await memberActionUrl(env, memberId), variant: "secondary" }
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
            { label: `Report ${memberName} as no longer active`, url: await memberActionUrl(env, memberId), variant: "secondary" }
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
  const action = await verifyMemberInactivationToken(env, clean(body.actionToken, 4096));
  if (!action) return json(request, env, 410, { ok: false, error: "This secure action link is invalid or has expired." });
  const memberId = clean(action.memberId, 100);
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

function stringArrayField(values) {
  return { arrayValue: { values: [...new Set(values.filter(Boolean))].map((value) => stringField(value)) } };
}

async function reconcileAcceptedJoinParent(env, uid, signedInEmail, application, memberId) {
  const member = await privilegedDocument(env, "members", memberId);
  if (!member || fieldString(member, "status") !== "active") throw new Error("Accepted Join Us member is unavailable.");
  const section = fieldString(member, "section");
  const existing = await privilegedDocument(env, "parentAccounts", uid);
  const memberIds = [...new Set([...(existing ? fieldStringArray(existing, "memberIds") : []), memberId])].slice(0, 8);
  const linkedSections = [...new Set([...(existing ? fieldStringArray(existing, "linkedSections") : []), section].filter(Boolean))];
  const displayName = existing ? fieldString(existing, "displayName") : fieldString(application, "parentName");
  const mobileNumber = existing ? fieldString(existing, "mobileNumber") : fieldString(application, "mobileNumber");
  const fields = {
    uid: stringField(uid),
    email: stringField(signedInEmail),
    displayName: stringField(displayName || "Parent / Guardian"),
    mobileNumber: stringField(mobileNumber || "Not provided"),
    status: stringField("approved"),
    memberIds: stringArrayField(memberIds),
    linkedSections: stringArrayField(linkedSections),
    requestedChildren: existing?.fields?.requestedChildren || { arrayValue: { values: [] } }
  };
  const write = {
    update: { name: documentName(env, "parentAccounts", uid), fields },
    updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }]
  };
  if (existing) {
    write.updateMask = { fieldPaths: ["uid", "email", "displayName", "mobileNumber", "status", "memberIds", "linkedSections", "requestedChildren"] };
    write.currentDocument = { updateTime: existing.updateTime };
  } else {
    write.updateTransforms.unshift({ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" });
    write.currentDocument = { exists: false };
  }
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await serviceAccessToken(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ writes: [write] })
  });
  if (!response.ok) throw new Error(`Firestore accepted-parent reconciliation failed with ${response.status}.`);
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

export function resolveJoinLeaderRecipients(profiles, leadership, section, configuredAdmins = []) {
  const byUid = new Map(leadership.map((item) => [documentId(item), item]));
  const sectionLeaders = [];
  const groupLeaders = [];
  for (const profile of profiles) {
    if (!fieldBoolean(profile, "active")) continue;
    const uid = documentId(profile);
    const appointmentRecord = byUid.get(uid);
    if (!appointmentRecord || !fieldBoolean(appointmentRecord, "active")) continue;
    const appointments = fieldMapArray(appointmentRecord, "appointments");
    const legacyRole = fieldString(appointmentRecord, "scoutingRole");
    const legacyScope = fieldString(appointmentRecord, "organisationSection") || "Group";
    const sectionMatch = appointments.some((appointment) =>
      activeAppointment(appointment) && fieldMapString(appointment, "appointment") === "Section Leader" &&
      fieldMapString(appointment, "scope") === section
    ) || (appointments.length === 0 && legacyRole === "Section Leader" && legacyScope === section);
    const groupMatch = appointments.some((appointment) =>
      activeAppointment(appointment) && ["Group Leader", "Deputy Group Leader"].includes(fieldMapString(appointment, "appointment"))
    ) || (appointments.length === 0 && ["Group Leader", "Deputy Group Leader", "Deputy-Group-Leader", "DGL"].includes(legacyRole));
    const email = validEmail(fieldString(profile, "email"));
    if (!email) continue;
    if (sectionMatch) sectionLeaders.push(email);
    if (groupMatch) groupLeaders.push(email);
  }
  const admins = (Array.isArray(configuredAdmins) ? configuredAdmins : String(configuredAdmins || "").split(","))
    .map(validEmail).filter(Boolean);
  return [...new Set([...admins, ...(sectionLeaders.length ? sectionLeaders : groupLeaders)])];
}

async function joinEventKey(applicationId, event) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${applicationId}
${event}`));
  return base64Url(new Uint8Array(digest));
}

async function joinEventAlreadySent(env, key) {
  return Boolean(await privilegedDocument(env, "joinApplicationEmailDeliveries", key));
}

async function recordJoinEventSent(env, key, event) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await serviceAccessToken(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ writes: [{
      update: { name: documentName(env, "joinApplicationEmailDeliveries", key), fields: { event: stringField(event), state: stringField("sent") } },
      updateTransforms: [{ fieldPath: "sentAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false }
    }] })
  });
  if (!response.ok && response.status !== 409 && response.status !== 412) throw new Error(`Firestore join-email ledger write failed with ${response.status}.`);
}

async function sendJoinLifecycleEmail(env, applicationId, event, recipients, subject, content) {
  const uniqueRecipients = [...new Set(recipients.map(validEmail).filter(Boolean))];
  if (!uniqueRecipients.length) return false;
  const key = await joinEventKey(applicationId, event);
  if (await joinEventAlreadySent(env, key)) return false;
  await sendEmail(env, uniqueRecipients, subject, brandedEmail(content), `join-lifecycle:${key}`);
  await recordJoinEventSent(env, key, event);
  return true;
}

function joinChildName(application) {
  return `${fieldString(application, "childFirstName")} ${fieldString(application, "childLastName")}`.trim() || "your child";
}

function joinParentHello(application) {
  return fieldString(application, "parentName").trim() || "Parent / Guardian";
}

async function authoritativeJoinLeaderRecipients(env, section) {
  const [profiles, leadership] = await Promise.all([
    privilegedDocuments(env, "adminUsers"),
    privilegedDocuments(env, "organisationLeadership")
  ]);
  return resolveJoinLeaderRecipients(profiles, leadership, section, env.ADMIN_EMAILS || "");
}

async function handleJoinApplicationLifecycle(request, env, body) {
  const applicationId = clean(body.applicationId, 200);
  if (!applicationId) return json(request, env, 400, { ok: false, error: "Missing application id." });
  const application = await privilegedDocument(env, "joinApplications", applicationId);
  if (!application || fieldString(application, "status") !== "new") return json(request, env, 404, { ok: false, error: "Join application unavailable." });
  const email = validEmail(fieldString(application, "emailAddress"));
  if (!email) return json(request, env, 422, { ok: false, error: "Application has no valid parent email." });
  const childName = joinChildName(application);
  const parentName = joinParentHello(application);
  const section = fieldString(application, "section");
  const errors = [];
  try {
    await sendJoinLifecycleEmail(env, applicationId, "received-parent", [email], "Join Us application received – Coolock Ardlea Scouts", {
      heading: "Join Us application received",
      intro: `Hello ${parentName}, we have received your application for ${childName}.`,
      bodyHtml: `<p style="font-size:16px;line-height:1.6">This confirms receipt only. Your child has not yet been accepted and a place or start date is not confirmed. We will contact you again when the application status changes.</p>`
    });
  } catch (error) { errors.push(error); }
  try {
    const leaders = await authoritativeJoinLeaderRecipients(env, section);
    if (!leaders.length) throw new Error("No configured Section Leader, Group Leader, or administrator recipient for Join Us application.");
    const recipients = leaders;
    const bodyHtml = `<table role="presentation" style="font-size:15px;line-height:1.6;border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0;font-weight:700">Applicant</td><td>${escapeHtml(childName)}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:700">Section</td><td>${escapeHtml(section)}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:700">Parent / Guardian</td><td>${escapeHtml(parentName)}</td></tr></table>`;
    await sendJoinLifecycleEmail(env, applicationId, "received-leaders", recipients, `New Join Us application – ${childName}`, {
      heading: "New Join Us application", intro: "A new application has been submitted through the website.", bodyHtml,
      actions: [{ label: "Review application", url: `${String(env.SITE_URL || "").replace(/\/$/, "")}/leader/join/${encodeURIComponent(applicationId)}` }]
    });
  } catch (error) { errors.push(error); }
  if (errors.length) throw errors[0];
  return json(request, env, 200, { ok: true });
}

async function handleJoinApplicationStatus(request, env, body) {
  const applicationId = clean(body.applicationId, 200);
  const status = clean(body.status, 40);
  if (!applicationId || !["waiting-list", "accepted"].includes(status)) return json(request, env, 400, { ok: false, error: "Invalid Join Us status notification." });
  const claims = decodeFirebaseClaims(bearer(request));
  const uid = clean(claims.user_id || claims.sub, 200);
  const leader = uid ? await getDocumentWithToken(env, bearer(request), "adminUsers", uid) : null;
  if (!leader || !fieldBoolean(leader, "active") || !["leader", "admin", "super-admin"].includes(fieldString(leader, "role"))) return json(request, env, 403, { ok: false, error: "Active leader access is required." });
  const application = await privilegedDocument(env, "joinApplications", applicationId);
  if (!application || fieldString(application, "status") !== status) return json(request, env, 409, { ok: false, error: "Join application status has changed." });
  const role = fieldString(leader, "role");
  const leaderSections = fieldStringArray(leader, "sections");
  const legacySection = fieldString(leader, "section");
  const leadership = await getDocumentWithToken(env, bearer(request), "organisationLeadership", uid);
  const groupLeader = leadership && fieldBoolean(leadership, "active") && new Set(["Group Leader", "Deputy Group Leader", "Deputy-Group-Leader", "Deputy GroupLead", "DGL"]).has(fieldString(leadership, "scoutingRole"));
  if (!new Set(["admin", "super-admin"]).has(role) && !groupLeader && !leaderSections.includes(fieldString(application, "section")) && legacySection !== fieldString(application, "section")) return json(request, env, 403, { ok: false, error: "You are not authorised for this Join Us section." });
  const email = validEmail(fieldString(application, "emailAddress"));
  if (!email) return json(request, env, 422, { ok: false, error: "Application has no valid parent email." });
  const childName = joinChildName(application);
  const parentName = joinParentHello(application);
  const section = fieldString(application, "section");
  const waiting = status === "waiting-list";
  const content = waiting ? {
    heading: "Join Us application update — waiting list",
    intro: `Hello ${parentName}, ${childName} has been placed on the waiting list for ${section}.`,
    bodyHtml: `<p style="font-size:16px;line-height:1.6">This does not confirm a place or start date. The relevant leaders have been informed and we will contact you if the status changes.</p>`
  } : {
    heading: "Join Us application accepted",
    intro: `Hello ${parentName}, your Join Us application has been accepted.`,
    bodyHtml: `<p style="font-size:16px;line-height:1.6">Sign in to the Parent Portal using the email address from your application. If prompted, link or verify the accepted member with the Group. Once the member is linked to your account, open Consent &amp; Medical inside the portal to complete the form. If the member is not listed, contact the Group to verify the link. For privacy, this email does not include personal or consent details.</p>`,
    actions: [{ label: "Open Parent Portal", url: `${String(env.SITE_URL || "").replace(/\/$/, "")}/parent` }]
  };
  await sendJoinLifecycleEmail(env, applicationId, `status-${status}`, [email], waiting ? "Join Us application update — waiting list" : "Join Us application accepted — complete your consent form", content);
  return json(request, env, 200, { ok: true });
}

async function handleJoinConsentContext(request, env, body) {
  const action = await verifyJoinConsentToken(env, clean(body.joinToken, 4096));
  if (!action) return json(request, env, 410, { ok: false, error: "This Join Us consent link is invalid or has expired." });
  const claims = decodeFirebaseClaims(bearer(request));
  const signedInEmail = validEmail(claims.email);
  const application = await privilegedDocument(env, "joinApplications", clean(action.applicationId, 200));
  if (!application || fieldString(application, "status") !== "accepted" || !signedInEmail || signedInEmail !== validEmail(fieldString(application, "emailAddress"))) {
    return json(request, env, 403, { ok: false, error: "This link is not available to this signed-in parent." });
  }
  const memberId = fieldString(application, "memberId");
  if (!memberId) return json(request, env, 409, { ok: false, error: "The accepted application has not been linked to a member record yet." });
  const uid = clean(claims.user_id || claims.sub, 200);
  if (!uid) return json(request, env, 401, { ok: false, error: "Sign-in required." });
  await reconcileAcceptedJoinParent(env, uid, signedInEmail, application, memberId);
  return json(request, env, 200, { ok: true, memberId });
}

async function commitMemberInactivation(env, actor, memberId, member, parentAccounts, actionLinkId) {
  const serviceToken = await serviceAccessToken(env);
  const historyId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const section = fieldString(member, "section");
  const memberName = fieldString(member, "displayName") || "Member";
  const writes = [
    {
      update: {
        name: documentName(env, "consumedActionLinks", actionLinkId),
        fields: {
          purpose: stringField("member-inactivation"),
          memberId: stringField(memberId),
          consumedBy: stringField(actor.uid)
        }
      },
      updateTransforms: [{ fieldPath: "consumedAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false }
    },
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
  const action = await verifyMemberInactivationToken(env, clean(body.actionToken, 4096));
  if (!action) return json(request, env, 410, { ok: false, error: "This secure action link is invalid or has expired." });
  const memberId = clean(action.memberId, 100);
  if (body.confirm !== true) return json(request, env, 400, { ok: false, error: "Explicit confirmation is required." });
  const parent = await authenticatedParentMember(request, env, memberId);
  const leader = parent ? null : await authenticatedLeaderMember(request, env, memberId);
  const authorised = parent || leader;
  if (!authorised) return json(request, env, 403, { ok: false, error: "You are not authorised to manage this member." });

  const [current, consumed] = await Promise.all([
    privilegedDocument(env, "members", memberId),
    privilegedDocument(env, "consumedActionLinks", action.jti)
  ]);
  if (!current) return json(request, env, 404, { ok: false, error: "Member not found." });
  if (consumed && fieldString(current, "status") === "active") return json(request, env, 410, { ok: false, error: "This secure action link has already been used." });
  const currentStatus = fieldString(current, "status");
  if (currentStatus !== "active") return json(request, env, 200, { ok: true, alreadyInactive: true, status: currentStatus });

  const parents = await linkedApprovedParents(env, memberId);
  const actor = { uid: authorised.uid, email: authorised.email || "" };
  const committed = await commitMemberInactivation(env, actor, memberId, current, parents, action.jti);
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


function localIsoDate(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function daysBetweenIsoDates(from, to) {
  const parse = (value) => {
    const [year, month, day] = String(value).split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export async function runLeaderMedicalRenewalReminders(env, now = new Date()) {
  const reminderDays = Math.max(1, Math.min(120, Number(env.LEADER_MEDICAL_REMINDER_DAYS || 45)));
  const today = localIsoDate(now);
  const [forms, leaders] = await Promise.all([
    privilegedDocuments(env, "consentApplications"),
    privilegedDocuments(env, "adminUsers")
  ]);
  const latestByUid = new Map();
  for (const form of forms) {
    if (fieldString(form, "formType") !== "scouter-es3-medical-advice") continue;
    const uid = fieldString(form, "submittedByUid");
    const validityFrom = fieldString(form, "validityFrom");
    const validityTo = fieldString(form, "validityTo");
    if (!uid || !validityFrom || !validityTo) continue;
    const current = latestByUid.get(uid);
    if (!current || validityFrom > current.validityFrom) latestByUid.set(uid, { form, validityFrom, validityTo });
  }

  let sent = 0;
  let skipped = 0;
  for (const leader of leaders) {
    const uid = documentId(leader);
    if (!uid || !fieldBoolean(leader, "active")) continue;
    const current = latestByUid.get(uid);
    if (!current) { skipped += 1; continue; }
    const remaining = daysBetweenIsoDates(today, current.validityTo);
    if (remaining < 0 || remaining > reminderDays) { skipped += 1; continue; }
    const email = validEmail(fieldString(leader, "email"));
    if (!email) { skipped += 1; continue; }

    const cycleKey = `leader-medical-renewal:${current.validityTo}`;
    const id = reminderDocumentId({ memberId: uid, recipientUid: uid, cycleKey, reminderType: "leader-medical-renewal" });
    const existing = await privilegedDocument(env, "consentReminderDeliveries", id);
    if (!shouldAttemptReminder(existing ? { status: fieldString(existing, "status") } : null)) { skipped += 1; continue; }
    const previousAttempts = Number(existing?.fields?.attemptCount?.integerValue || 0);
    const attemptCount = previousAttempts + 1;
    const record = (status) => ({
      memberId: uid,
      recipientUid: uid,
      formType: "scouter-es3-medical-advice",
      cycleKey,
      reason: "renewal",
      status,
      attemptCount,
      actionPath: "/leader/profile/consent",
      deliveryChannel: "email"
    });
    await persistReminderState(env, id, record("sending"), existing);
    try {
      const displayName = fieldString(leader, "displayName") || "Scouter";
      const actionUrl = `${String(env.SITE_URL || "").replace(/\/$/, "")}/leader/profile/consent`;
      await sendEmail(env, email, "Renew your Scouter Consent & Medical Form – Coolock Ardlea Scouts", brandedEmail({
        heading: "Scouter medical form renewal",
        intro: `Hello ${displayName}, your current Scouter Consent & Medical Form is due for review by 31 August.`,
        bodyHtml: `<p style="font-size:16px;line-height:1.6">Please review and update your form before <strong>${escapeHtml(current.validityTo)}</strong>. For privacy, this email contains no medical details.</p>`,
        actions: [{ label: "Review My Scouter Form", url: actionUrl }]
      }), `leader-medical-renewal:${id}`);
      await persistReminderState(env, id, record("sent"));
      sent += 1;
    } catch (error) {
      await persistReminderState(env, id, record("failed"));
      throw error;
    }
  }
  return { sent, skipped, checked: leaders.length };
}

async function handleRegisteredScouters(request, env) {
  const leadership = await privilegedDocuments(env, "organisationLeadership");
  const scouters = [];
  for (const record of leadership) {
    if (!fieldBoolean(record, "active")) continue;
    const uid = documentId(record);
    const profile = await privilegedDocument(env, "adminUsers", uid);
    if (!profile || !fieldBoolean(profile, "active")) continue;
    const appointments = fieldMapArray(record, "appointments").filter(activeAppointment);
    const sections = [...new Set([
      fieldString(record, "organisationSection"),
      fieldString(record, "primarySection"),
      ...appointments.map((item) => fieldMapString(item, "scope"))
    ].filter((section) => section && section !== "Group" && section !== "Other"))];
    scouters.push({
      uid,
      displayName: fieldString(record, "displayName") || fieldString(profile, "displayName"),
      scoutingRole: fieldString(record, "scoutingRole"),
      sections
    });
  }
  scouters.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.uid.localeCompare(b.uid));
  return json(request, env, 200, { ok: true, scouters });
}

export async function handleProductionRoute(request, env, body, path) {
  if (path === "/registered-scouters") return handleRegisteredScouters(request, env);
  if (path === "/join-application") return handleJoinApplicationLifecycle(request, env, body);
  if (path === "/join-application-status") return handleJoinApplicationStatus(request, env, body);
  if (path === "/join-consent-context") return handleJoinConsentContext(request, env, body);
  if (path === "/leader-communication") return handleLeaderCommunication(request, env, body);
  if (path === "/event-notification") return handleEventNotification(request, env, body);
  if (path === "/event-audience-save") return handleEventAudienceSave(request, env, body);
  if (path === "/event-consent-processed") return handleEventConsentProcessed(request, env, body);
  if (path === "/form-reminder") return handleFormReminder(request, env, body);
  if (path === "/member-inactivation-context") return handleMemberInactivationContext(request, env, body);
  if (path === "/member-inactivation") return handleMemberInactivation(request, env, body);
  return null;
}
