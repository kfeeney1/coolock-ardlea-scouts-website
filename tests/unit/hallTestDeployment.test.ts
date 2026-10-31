import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {hallTestDeploymentErrors} from "../../scripts/check-hall-test-deployment.mjs";
import {checkTestHallBackend} from "../../scripts/check-test-hall-backend.mjs";
import {applicationEnvironmentErrors} from "../../scripts/check-production-env.mjs";
const commit = "a".repeat(40), origin = "https://coolock-ardlea-scouts-hall-test.synthetic.workers.dev";
const env = {FIREBASE_PROJECT_ID: "coolock-ardlea-scouts-test", HALL_FREE_PLAN_CONFIRMED: "true", HALL_BUILD_COMMIT: commit, CLOUDFLARE_API_TOKEN: "synthetic", CLOUDFLARE_ACCOUNT_ID: "synthetic", VITE_HALL_BOOKING_API_URL: origin, EXPECTED_WORKER_SHA: commit};
test("TEST deployment requires verified existing Free capacity, isolated config and explicit reviewed revision", async () => {
  const config = await readFile("email-worker/wrangler.hall-test.toml", "utf8");
  assert.deepEqual(hallTestDeploymentErrors(env, config), []);
  for (const field of Object.keys(env).filter(field => field !== "EXPECTED_WORKER_SHA")) assert.ok(hallTestDeploymentErrors({...env, [field]: ""}, config).length, field);
  for (const addition of ['\n[[kv_namespaces]]\nbinding = "PAID"', '\n[triggers]\ncrons = ["* * * * *"]', '\nroute = "production.invalid/*"']) assert.ok(hallTestDeploymentErrors(env, config + addition).length);
  assert.ok(hallTestDeploymentErrors(env, config.replace("[vars]", "[triggers]").replace("[triggers]\ncrons", "[vars]\ncrons")).length);
  assert.ok(hallTestDeploymentErrors(env, config.replace('name = "coolock-ardlea-scouts-hall-test"', 'name = "coolock-ardlea-scouts-email"')).length);
});
function response(url: string, options: RequestInit = {}) {
  const path = new URL(url).pathname, requestOrigin = new Headers(options.headers).get("Origin");
  if (path === "/health") return Response.json({service: "hall-bookings-test", environment: "test", project: env.FIREBASE_PROJECT_ID, commit}, {headers: {"X-Hall-Backend-Commit": commit}});
  if (options.method === "OPTIONS") return new Response(null, {status: 204, headers: {"Access-Control-Allow-Origin": requestOrigin!}});
  return Response.json({ok: false}, {status: path !== "/hall-bookings" ? 404 : requestOrigin === "https://coolockardleascouts.ie" ? 403 : 401});
}
test("public preflight checks exact identity and negative boundaries without tokens, writes or lifecycle claims", async () => {
  const calls: string[] = [];
  const result = await checkTestHallBackend(env, async (url: string, options: RequestInit) => {
    assert.equal(new URL(url).origin, origin); assert.equal(options.redirect, "error"); assert.equal(new Headers(options.headers).has("Authorization"), false);
    if (options.method === "POST") assert.equal(options.body, '{"action":"list"}');
    calls.push(url); return response(url, options);
  });
  assert.equal(calls.length, 5); assert.equal(result.functionalAcceptance, false); assert.equal(result.workerCommit, commit);
});
test("preflight rejects stale/wrong identity, oversized metadata and allowed unauthorised requests", async () => {
  for (const fetcher of [async () => Response.json({commit: "b".repeat(40)}), async () => new Response("x".repeat(4097)), async (url: string, options: RequestInit) => new URL(url).pathname === "/health" ? response(url, options) : Response.json({private: "must not appear"})]) await assert.rejects(checkTestHallBackend(env, fetcher));
  await assert.rejects(checkTestHallBackend({...env, VITE_HALL_BOOKING_API_URL: "https://production.invalid"}, () => {throw new Error("must not fetch");}));
});
test("TEST builds allow absent isolated transport while rejecting accidental Production backend configuration", () => {
  const buildEnv = {DEPLOY_ENVIRONMENT: "test", FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, VITE_FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, VITE_FIREBASE_API_KEY: "synthetic", VITE_FIREBASE_AUTH_DOMAIN: "synthetic", VITE_FIREBASE_STORAGE_BUCKET: "synthetic", VITE_FIREBASE_MESSAGING_SENDER_ID: "synthetic", VITE_FIREBASE_APP_ID: "synthetic", VITE_EMAIL_API_URL: ""};
  assert.deepEqual(applicationEnvironmentErrors(buildEnv), []);
  assert.deepEqual(applicationEnvironmentErrors({...buildEnv, VITE_HALL_BOOKING_API_URL: origin}), []);
  assert.ok(applicationEnvironmentErrors({...buildEnv, VITE_HALL_BOOKING_API_URL: "https://production.invalid"}).length);
});
