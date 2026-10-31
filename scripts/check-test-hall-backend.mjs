import {pathToFileURL} from "node:url";
import {hallBookingEndpoint} from "../src/services/hallBookingEndpoint.ts";
async function json(response) {
  const reader = response.body?.getReader(); if (!reader) throw new Error("Metadata unavailable.");
  const chunks = []; let length = 0;
  try {
    while (true) {const {done, value} = await reader.read(); if (done) break; length += value.length; if (length > 4096) throw new Error("Metadata too large."); chunks.push(value);}
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {await reader.cancel(); reader.releaseLock();}
}
/** Public metadata and denied unauthenticated requests only; not lifecycle acceptance. */
export async function checkTestHallBackend(env, fetcher = fetch) {
  const endpoint = hallBookingEndpoint({appEnv: "test", firebaseProjectId: env.FIREBASE_PROJECT_ID, hallApiUrl: env.VITE_HALL_BOOKING_API_URL});
  if (!endpoint || !/^[a-f0-9]{40}$/.test(env.EXPECTED_WORKER_SHA ?? "")) throw new Error("Explicit TEST endpoint/revision required.");
  const base = new URL(endpoint).origin, origin = "https://coolock-ardlea-scouts-test.web.app";
  const get = (url, options = {}) => fetcher(url, {...options, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000)});
  const health = await get(`${base}/health`), metadata = await json(health);
  if (health.status !== 200 || metadata.service !== "hall-bookings-test" || metadata.environment !== "test" || metadata.project !== env.FIREBASE_PROJECT_ID || metadata.commit !== env.EXPECTED_WORKER_SHA || health.headers.get("X-Hall-Backend-Commit") !== env.EXPECTED_WORKER_SHA) throw new Error("TEST backend identity/revision mismatch.");
  const probes = [];
  for (const [name, path, requestOrigin, method, status] of [["anonymous-denied", "/hall-bookings", origin, "POST", 401], ["production-origin-denied", "/hall-bookings", "https://coolockardleascouts.ie", "POST", 403], ["email-route-absent", "/event-parent-notification", origin, "POST", 404], ["test-preflight", "/hall-bookings", origin, "OPTIONS", 204]]) {
    const response = await get(`${base}${path}`, {method, headers: {Origin: requestOrigin, "Content-Type": "application/json"}, ...(method === "POST" ? {body: '{"action":"list"}'} : {})});
    if (response.status !== status || (name === "production-origin-denied" && response.headers.has("Access-Control-Allow-Origin")) || (name === "test-preflight" && response.headers.get("Access-Control-Allow-Origin") !== origin)) throw new Error("TEST backend boundary check failed.");
    await response.body?.cancel(); probes.push({name, status});
  }
  return {project: env.FIREBASE_PROJECT_ID, workerCommit: metadata.commit, functionalAcceptance: false, probes};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {console.log(JSON.stringify(await checkTestHallBackend(process.env), null, 2));}
  catch {console.error("TEST booking backend verification could not complete. Check the isolated configuration and exact revision; no lifecycle/Production acceptance is inferred."); process.exitCode = 1;}
}
