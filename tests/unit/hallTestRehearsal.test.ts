import test from "node:test";
import assert from "node:assert/strict";
import {assertRehearsalDeployment, planHallTestRehearsal, startHallTestRehearsal, stopHallTestRehearsal} from "../../scripts/hall-test-rehearsal.mjs";
import {hallControlOptions, rehearsalDeployment} from "../../scripts/reconcile-hall-reservations.mjs";
const uid = "operator", project = "demo-hall-rehearsal", commit = "a".repeat(40), now = Date.parse("2026-10-31T12:00:00.000Z");
const scope = {from: "2026-10-31", through: "2027-10-31"};
const deployment = () => ({project, commit, workerCommit: commit, functionalAcceptance: false, build: {commit, environment: "local", source: "local"}});
function snapshot() {
  return {collections: new Map<string, Map<string, any>>([["hall", new Map([["group", {ready: false, revision: 0}]])], ["siteSettings", new Map()]]), versions: new Map(), creations: new Map(), readVersion: "100:0", evidence: new Map(), reviewEvidence: new Map(), taskExists: new Set(), truncated: [], operator: [{active: true, role: "super-admin", sections: ["Cubs"]}, {active: true, scoutingRole: "Group Leader"}]};
}
test("rehearsal planning is read-only, digest-bound and never records acceptance or rollout approval", async () => {
  const data = snapshot(), before = structuredClone(data), result = await planHallTestRehearsal(data, uid, project, scope, deployment(), now);
  assert.equal(result.canStart, true, JSON.stringify(result.blockers)); assert.equal(result.acceptanceRecorded, false); assert.equal(result.activationApproved, false); assert.equal(result.manualStopRequired, true); assert.deepEqual(data, before);
  data.collections.get("hall")!.get("group").revision = 1;
  assert.notEqual((await planHallTestRehearsal(data, uid, project, scope, deployment(), now)).digest, result.digest);
});
test("all legacy sources and indexed periods require reconciliation; no fixture or narrowed-horizon bypass", async () => {
  const data = snapshot(); data.collections.set("events", new Map([["unknown", {status: "open", section: "Cubs", startDate: "2029-01-01", endDate: "2029-01-01"}]])); data.creations.set("events/unknown", "50:0");
  const result = await planHallTestRehearsal(data, uid, project, scope, deployment(), now);
  assert.equal(result.canStart, false); assert.ok(result.blockers.some((item: any) => item.code === "unconfirmed-source-use"));
  await assert.rejects(planHallTestRehearsal(snapshot(), uid, project, {...scope, through: "2026-11-01"}, deployment(), now));
});
test("missing/revoked operator scope, active sessions and non-staging configuration cannot start", async () => {
  for (const change of ["inactive", "admin", "scouter", "active-session", "enabled", "ready"]) {
    const data = snapshot();
    if (change === "inactive") data.operator[0].active = false;
    if (change === "admin") data.operator[0].role = "admin";
    if (change === "scouter") data.operator[1].scoutingRole = "Scouter";
    if (change === "active-session") data.collections.get("hall")!.get("group").testRehearsal = {id: "1", state: "active"};
    if (change === "enabled") data.collections.get("siteSettings")!.set("hallHirePublic", {enabled: true});
    if (change === "ready") data.collections.get("hall")!.get("group").ready = true;
    await assert.rejects(planHallTestRehearsal(data, uid, project, scope, deployment(), now), change);
  }
});
test("native mutations reject Production and misleading project arguments before any transaction", async () => {
  for (const db of [{projectId: "coolock-ardlea-scouts"}, {projectId: project}]) {
    await assert.rejects(startHallTestRehearsal(db, uid, "coolock-ardlea-scouts-test", scope, deployment(), "a".repeat(64)), {code: "hall/environment"});
    await assert.rejects(stopHallTestRehearsal(db, uid, "coolock-ardlea-scouts-test"), {code: "hall/environment"});
  }
  assert.throws(() => assertRehearsalDeployment("coolock-ardlea-scouts", deployment(), now), {code: "hall/environment"});
});
test("live rehearsal requires exact TEST build/Worker identities and cannot use synthetic or acceptance claims", () => {
  const live = {...deployment(), project: "coolock-ardlea-scouts-test", build: {commit, environment: "test", source: "github-actions", buildTime: "2026-10-31T11:00:00.000Z"}};
  assert.doesNotThrow(() => assertRehearsalDeployment(live.project, live, now));
  for (const value of [deployment(), {...live, workerCommit: "b".repeat(40)}, {...live, functionalAcceptance: true}, {...live, build: {...live.build, environment: "production"}}, {...live, build: {...live.build, buildTime: "2026-11-01T00:00:00.000Z"}}]) assert.throws(() => assertRehearsalDeployment(live.project, value, now));
});
test("CLI modes require exact options and isolated emulator identities; stop needs no deployment availability", () => {
  const env = {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"};
  const args = ["--mode=rehearsal-plan", `--project=${project}`, `--from=${scope.from}`, `--through=${scope.through}`, `--commit=${commit}`];
  assert.equal(hallControlOptions(args, env).mode, "rehearsal-plan");
  assert.throws(() => hallControlOptions(args.slice(0, -1), env));
  assert.throws(() => hallControlOptions(args.map(arg => arg.startsWith("--project=") ? "--project=coolock-ardlea-scouts" : arg), {}));
  assert.throws(() => hallControlOptions(["--mode=rehearsal-stop", "--project=coolock-ardlea-scouts-test"], {FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"}));
  assert.equal(hallControlOptions(["--mode=rehearsal-stop", "--project=coolock-ardlea-scouts-test"], {}).mode, "rehearsal-stop");
});
test("deployment preflight fetches only fixed public metadata and anonymous negative probes; emulators make no cloud call", async () => {
  const noFetch = () => {throw new Error("No live call allowed.");};
  assert.equal((await rehearsalDeployment({project, commit}, {}, noFetch)).build.environment, "local");
  const endpoint = "https://coolock-ardlea-scouts-hall-test.synthetic.workers.dev";
  const result = await rehearsalDeployment({project: "coolock-ardlea-scouts-test", commit}, {VITE_HALL_BOOKING_API_URL: endpoint}, async (input: string, options: RequestInit) => {
    assert.equal(options.redirect, "error"); assert.equal(new Headers(options.headers).has("Authorization"), false);
    const url = new URL(input);
    if (url.hostname === "coolock-ardlea-scouts-test.web.app") return Response.json({commit, environment: "test", source: "github-actions", buildTime: "2026-10-31T01:00:00.000Z"});
    assert.equal(url.origin, endpoint);
    if (url.pathname === "/health") return Response.json({commit, environment: "test", service: "hall-bookings-test", project: "coolock-ardlea-scouts-test"}, {headers: {"X-Hall-Backend-Commit": commit}});
    const origin = new Headers(options.headers).get("Origin")!;
    if (options.method === "OPTIONS") return new Response(null, {status: 204, headers: {"Access-Control-Allow-Origin": origin}});
    assert.equal(options.body, '{"action":"list"}');
    return Response.json({ok: false}, {status: url.pathname !== "/hall-bookings" ? 404 : origin === "https://coolockardleascouts.ie" ? 403 : 401});
  });
  assert.equal(result.functionalAcceptance, false); assert.equal(result.workerCommit, commit);
  await assert.rejects(rehearsalDeployment({project: "coolock-ardlea-scouts-test", commit}, {VITE_HALL_BOOKING_API_URL: endpoint}, async () => Response.json({commit: "b".repeat(40)})));
});
