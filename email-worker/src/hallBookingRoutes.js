import { saveHallMaintenanceSource } from "./hallMaintenanceSource.js";
import { assertHallCouncil, hallFailure, hallId, HallBookingError, saveHallBooking } from "./hallBookingModel.js";
import { hallFirestore } from "./hallFirestore.js";

function signedUid(token) {
  try {
    const claims = JSON.parse(atob(token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")));
    return typeof claims.sub === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(claims.sub) ? claims.sub : "";
  } catch { return ""; }
}

async function boundedBody(request) {
  if (Number(request.headers.get("Content-Length")) > 32_768) hallFailure(413, "hall/payload", "Booking request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks = []; let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 32_768) { await reader.cancel(); hallFailure(413, "hall/payload", "Booking request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}

/** Existing Worker endpoint; no email is sent and no new service is provisioned. */
export async function handleHallBookingRoute(request, env, getServiceToken, fetcher = fetch) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = String(env.ALLOWED_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  const permitted = allowed.includes(origin);
  const headers = {"Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Origin", ...(permitted ? {"Access-Control-Allow-Origin": origin} : {}), "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS"};
  const reply = (status, value) => new Response(JSON.stringify(value), {status, headers});
  if (!permitted) return reply(403, {ok: false, code: "hall/origin", error: "Origin is not authorised."});
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers});
  if (request.method !== "POST") return reply(405, {ok: false, error: "POST is required."});
  try {
    const token = request.headers.get("Authorization")?.match(/^Bearer ([^\s]+)$/)?.[1] ?? "", uid = signedUid(token);
    if (!uid) hallFailure(401, "hall/unauthenticated", "Valid leader sign-in is required.");
    const raw = await boundedBody(request);
    let body;
    try { body = JSON.parse(raw); } catch { hallFailure(400, "hall/invalid", "A JSON booking request is required."); }
    if (!body || typeof body !== "object" || Array.isArray(body) || !["save", "list", "history", "get", "maintenance-save", "maintenance-cancel"].includes(body.action)) hallFailure(400, "hall/invalid", "Choose a booking action.");
    const store = hallFirestore(env, await getServiceToken(env), fetcher);
    await store.verifyUser(uid, token);
    if (["maintenance-save", "maintenance-cancel"].includes(body.action)) return reply(200, {ok: true, ...await saveHallMaintenanceSource(store, uid, body.command, {cancel: body.action === "maintenance-cancel"})});
    if (body.action === "save") return reply(200, {ok: true, ...await saveHallBooking(store, uid, body.command)});
    const result = await store.transaction(async tx => {
      const [profile, organisation, setting, lock] = await tx.read([`adminUsers/${uid}`, `organisationLeadership/${uid}`, "siteSettings/hallHire", "hall/group"]);
      assertHallCouncil(profile, organisation, Date.now());
      if (setting?.enabled !== true || lock?.ready !== true) hallFailure(409, "hall/disabled", "Hall booking administration is not enabled.");
      if (body.cursor && !hallId(body.cursor)) hallFailure(400, "hall/invalid", "Invalid page cursor.");
      if (body.action === "get") {
        if (!hallId(body.id)) hallFailure(400, "hall/invalid", "Invalid booking reference.");
        return {item: (await tx.read([`hall/group/bookings/${body.id}`]))[0]};
      }
      if (body.action === "history" && !hallId(body.id)) hallFailure(400, "hall/invalid", "Invalid booking reference.");
      return tx.list(body.action === "history" ? `hall/group/bookings/${body.id}/history` : "hall/group/bookings", body.cursor ?? "");
    }, {readOnly: true});
    return reply(200, {ok: true, ...result});
  } catch (error) {
    if (error instanceof HallBookingError) return reply(error.status, {ok: false, code: error.code, error: error.message});
    return reply(503, {ok: false, code: "hall/unavailable", error: "Unable to complete this hall booking request."});
  }
}
