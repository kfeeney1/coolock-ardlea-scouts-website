// Privileged queries discover candidates only. Every returned path is checked
// with the caller's Firebase token and the deployed document Rules.
const collections = new Set(["events", "publicEvents", "parentGalleryEvents", "audienceMembers", "eventConsentLinks", "eventConsentResponses", "auditLog"]);
const fields = new Set(["eventId", "memberId", "section", "status", "active", "audienceVersion", "programmeVisible", "startDate", "endDate"]);
const operators = { "==": "EQUAL", ">=": "GREATER_THAN_OR_EQUAL", "<=": "LESS_THAN_OR_EQUAL", "<": "LESS_THAN", ">": "GREATER_THAN", in: "IN" };
const string = (document, field) => document?.fields?.[field]?.stringValue || "";
const boolean = (document, field) => document?.fields?.[field]?.booleanValue === true;
const strings = (document, field) => (document?.fields?.[field]?.arrayValue?.values || []).map(value => value.stringValue).filter(Boolean);

function value(input) {
  if (typeof input === "string" && input.length <= 200) return { stringValue: input };
  if (typeof input === "boolean") return { booleanValue: input };
  if (Number.isInteger(input)) return { integerValue: String(input) };
  if (Array.isArray(input) && input.length > 0 && input.length <= 30) return { arrayValue: { values: input.map(value) } };
  throw new Error("Invalid event query value.");
}

function structuredQuery(body) {
  if (!collections.has(body.collection) || !Array.isArray(body.filters) || body.filters.length > 8) return null;
  try {
    const filters = body.filters.map(([field, operation, input]) => {
      if (!fields.has(field) || !operators[operation]) throw new Error("Invalid event query filter.");
      return { fieldFilter: { field: { fieldPath: field }, op: operators[operation], value: value(input) } };
    });
    const inequalityFields = [...new Set(body.filters.filter(([, operation]) => ["<", ">", "<=", ">="].includes(operation)).map(([field]) => field))];
    return {
      from: [{ collectionId: body.collection, allDescendants: body.collection === "audienceMembers" }],
      ...(filters.length ? { where: { compositeFilter: { op: "AND", filters } } } : {}),
      orderBy: [...inequalityFields, "__name__"].map(fieldPath => ({field: {fieldPath}, direction: "ASCENDING"})),
      limit: 200
    };
  } catch { return null; }
}

async function read(base, path, token) {
  const response = await fetch(`${base}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (response.status === 403 || response.status === 404 || response.status === 401) return null;
  if (!response.ok) throw new Error("Event authorization read failed.");
  return response.json();
}

function sourceId(path, document, collection) {
  if (collection === "auditLog") return ["event", "event-consent"].includes(string(document, "category")) ? string(document, "targetId") : null;
  return collection === "events" || collection === "publicEvents" || collection === "parentGalleryEvents"
    ? path.split("/").at(-1) : string(document, "eventId");
}

async function parentCanDiscoverLink(base, token, parent, link, eventId) {
  if (string(parent, "status") !== "approved" || !boolean(link, "active")) return false;
  const version = Number(link.fields?.audienceVersion?.integerValue || 2);
  for (const memberId of strings(parent, "memberIds").slice(0, 8)) {
    const member = await read(base, `members/${memberId}`, token);
    if (string(member, "status") !== "active") continue;
    if (version === 3) {
      const membership = await read(base, `events/${eventId}/audienceMembers/${memberId}`, token);
      if (string(membership, "memberId") === memberId && string(membership, "eventId") === eventId) return true;
    } else if ([1, 2].includes(version)) {
      const section = string(link, "section");
      if (["Group", "All Sections"].includes(section) || [string(member, "section"), ...strings(member, "sections")].includes(section)) return true;
    }
  }
  return false;
}

export async function discoverEventDocuments(request, body, { base, serviceToken }) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "private, no-store" };
  const respond = (status, payload) => new Response(JSON.stringify(payload), { status, headers });
  const query = structuredQuery(body);
  if (!query) return respond(400, { ok: false, error: "Invalid event query." });
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  let parent = null;
  let leader = null;
  if (token) {
    // Firebase validates the token on this document read. Decoded claims alone
    // never grant access. Each candidate gets another authoritative Rules check.
    let uid;
    try {
      const encoded = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
      uid = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="))).sub;
    } catch { return respond(401, { ok: false }); }
    if (typeof uid !== "string" || !uid || uid.includes("/")) return respond(401, { ok: false });
    [parent, leader] = await Promise.all([
      read(base, `parentAccounts/${uid}`, token), read(base, `adminUsers/${uid}`, token)
    ]);
    if (!parent && !leader) {
      // A linked youth account can read the public schedule, as can a visitor.
      if (body.collection !== "publicEvents") return respond(403, { ok: false });
    }
  } else if (body.collection !== "publicEvents") return respond(401, { ok: false });

  const superAdmin = boolean(leader, "active") && string(leader, "role") === "super-admin"
    && strings(leader, "sections").length > 0 && !Object.hasOwn(leader?.fields || {}, "section");
  const sourceCache = new Map();
  const source = async eventId => {
    if (!eventId || eventId.includes("/")) return null;
    if (!sourceCache.has(eventId)) sourceCache.set(eventId, read(base, `events/${eventId}`, await serviceToken()));
    return sourceCache.get(eventId);
  };
  const paths = [];
  let cursor;
  do {
    const response = await fetch(`${base}:runQuery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await serviceToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery: { ...query, ...(cursor ? { startAt: { values: cursor, before: false } } : {}) } })
    });
    if (!response.ok) throw new Error("Event candidate query failed.");
    const rows = (await response.json()).flatMap(row => row.document ? [row.document] : []);
    for (const candidate of rows) {
      const path = candidate.name.split("/documents/")[1];
      const eventId = sourceId(path, candidate, body.collection);
      const event = await source(eventId);
      const unrelatedAudit = body.collection === "auditLog" && eventId === null;
      if (!unrelatedAudit && (!event || (boolean(event, "hidden") && !superAdmin))) continue;
      // An active public token grants direct-link access, but discovery still
      // requires leader source access or an approved parent's exact audience.
      if (body.collection === "eventConsentLinks") {
        const permittedSource = await read(base, `events/${eventId}`, token);
        if (!permittedSource && !(await parentCanDiscoverLink(base, token, parent, candidate, eventId))) continue;
      }
      if (await read(base, path, token)) paths.push(path);
    }
    const last = rows.at(-1);
    cursor = rows.length === query.limit ? query.orderBy.map(order => order.field.fieldPath === "__name__"
      ? {referenceValue: last.name} : last.fields[order.field.fieldPath]) : null;
  } while (cursor);
  return respond(200, { ok: true, paths });
}
