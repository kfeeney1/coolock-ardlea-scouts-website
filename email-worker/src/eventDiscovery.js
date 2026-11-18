// Privileged queries discover candidates only. Every returned path is checked
// with the caller's Firebase token and the deployed document Rules.
const collections = new Set(["events", "publicEvents", "parentGalleryEvents", "audienceMembers", "eventConsentLinks", "eventConsentResponses", "auditLog", "equipmentProgrammeRequirements"]);
const fields = new Set(["eventId", "memberId", "targetId", "section", "status", "active", "audienceVersion", "programmeVisible", "startDate", "endDate"]);
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
      limit: 100
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
  if (collection === "equipmentProgrammeRequirements") return string(document, "sourceType") === "event" ? string(document, "sourceId") : null;
  if (collection === "auditLog") return ["event", "event-consent"].includes(string(document, "category")) ? string(document, "targetId") : null;
  return collection === "events" || collection === "publicEvents" || collection === "parentGalleryEvents"
    ? path.split("/").at(-1) : string(document, "eventId");
}

async function batchRead(base, paths, token) {
  const documents = `${base.split("/v1/")[1]}/`;
  const response = await fetch(`${base}:batchGet`, {
    method: "POST", headers: {"Content-Type": "application/json", ...(token ? {Authorization: `Bearer ${token}`} : {})},
    body: JSON.stringify({documents: paths.map(path => documents + path)})
  });
  if ([401, 403].includes(response.status)) return null;
  if (!response.ok) throw new Error("Event batch authorization failed.");
  return new Map((await response.json()).flatMap(row => row.found
    ? [[row.found.name.split("/documents/")[1], row.found]] : []));
}

async function parentCanDiscoverLink(parent, link, eventId, evidence) {
  if (string(parent, "status") !== "approved" || !boolean(link, "active")) return false;
  const version = Number(link.fields?.audienceVersion?.integerValue || 2);
  for (const memberId of strings(parent, "memberIds").slice(0, 8)) {
    const member = evidence.get(`members/${memberId}`);
    if (string(member, "status") !== "active") continue;
    if (version === 3) {
      const membership = evidence.get(`events/${eventId}/audienceMembers/${memberId}`);
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
  const accessToken = await serviceToken();
  const sourceCache = new Map();
  const paths = [];
  let cursor = body.cursor || null;
  if (cursor && (!Array.isArray(cursor) || cursor.length !== query.orderBy.length
    || JSON.stringify(cursor).length > 4096)) return respond(400, {ok: false});
  let more;
  do {
    const response = await fetch(`${base}:runQuery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery: { ...query, ...(cursor ? { startAt: { values: cursor, before: false } } : {}) } })
    });
    if (!response.ok) throw new Error("Event candidate query failed.");
    const rows = (await response.json()).flatMap(row => row.document ? [row.document] : []);
    const sourceIds = [...new Set(rows.map(candidate => sourceId(candidate.name, candidate, body.collection)).filter(id => id && !id.includes("/")))];
    const evidencePaths = sourceIds.map(id => `events/${id}`);
    if (body.collection === "eventConsentLinks" && string(parent, "status") === "approved") {
      const memberIds = strings(parent, "memberIds").slice(0, 8);
      evidencePaths.push(...memberIds.map(id => `members/${id}`),
        ...sourceIds.flatMap(id => memberIds.map(memberId => `events/${id}/audienceMembers/${memberId}`)));
    }
    const evidence = new Map();
    const missing = evidencePaths.filter(path => !sourceCache.has(path));
    for (let index = 0; index < missing.length; index += 100) {
      const batch = await batchRead(base, missing.slice(index, index + 100), accessToken);
      if (!batch) throw new Error("Event source authorization failed.");
      for (const path of missing.slice(index, index + 100)) sourceCache.set(path, batch.get(path) || null);
    }
    for (const path of evidencePaths) if (sourceCache.get(path)) evidence.set(path, sourceCache.get(path));
    const leaderEvents = new Set();
    const canonicalLeader = boolean(leader, "active") && ["leader", "admin", "super-admin"].includes(string(leader, "role"))
      && strings(leader, "sections").length > 0 && !Object.hasOwn(leader?.fields || {}, "section");
    if (body.collection === "eventConsentLinks" && canonicalLeader) {
      for (let index = 0; index < sourceIds.length; index += 8) {
        const ids = sourceIds.slice(index, index + 8);
        const authorized = await batchRead(base, ids.map(id => `events/${id}`), token);
        for (const id of ids) if (authorized ? authorized.has(`events/${id}`) : await read(base, `events/${id}`, token)) leaderEvents.add(id);
      }
    }
    const candidates = [];
    for (const candidate of rows) {
      const path = candidate.name.split("/documents/")[1];
      const eventId = sourceId(path, candidate, body.collection);
      const event = sourceCache.get(`events/${eventId}`);
      const retainedReference = ["auditLog", "equipmentProgrammeRequirements"].includes(body.collection) && (eventId === null || !event);
      if (!retainedReference && (!event || (boolean(event, "hidden") && !superAdmin))) continue;
      if (body.collection === "eventConsentLinks" && !leaderEvents.has(eventId)
        && !(await parentCanDiscoverLink(parent, candidate, eventId, evidence))) continue;
      candidates.push(candidate);
    }
    let lastAuthorized = null;
    for (let index = 0; index < candidates.length; index += 8) {
      const group = candidates.slice(index, index + 8);
      const groupPaths = group.map(candidate => candidate.name.split("/documents/")[1]);
      const authorized = await batchRead(base, groupPaths, token);
      for (const candidate of group) {
        const path = candidate.name.split("/documents/")[1];
        const allowed = authorized ? authorized.has(path) : Boolean(await read(base, path, token));
        if (allowed) {paths.push(path); lastAuthorized = candidate;}
      }
    }
    more = rows.length === query.limit;
    // Only a record the caller can read may be used as a client cursor.
    // Pages containing hidden records alone are traversed on the server.
    const last = lastAuthorized || rows.at(-1);
    cursor = more && last ? query.orderBy.map(order => order.field.fieldPath === "__name__"
      ? {referenceValue: last.name} : last.fields[order.field.fieldPath]) : null;
    if (lastAuthorized || !more) break;
  } while (cursor);
  return respond(200, { ok: true, paths, cursor: more ? cursor : null });
}
