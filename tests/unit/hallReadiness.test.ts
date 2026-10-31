import test from "node:test";
import assert from "node:assert/strict";
import {validateManifest, planHallReconciliation, importFields} from "../../scripts/hall-source-reconciliation.mjs";
import {assertTestEvidence, HALL_ACCEPTANCE_CHECKS} from "../../scripts/hall-readiness.mjs";
import {hallControlOptions, deployedTestBuild} from "../../scripts/reconcile-hall-reservations.mjs";
import {auditHallReservations} from "../../scripts/hall-reconciliation.mjs";
import {afterVersion, reviewedNonHall} from "../../scripts/hall-review-policy.mjs";
const uid = "operator", from = "2026-11-05", through = "2026-11-06", now = Date.parse("2026-10-31T12:00:00Z");
const interval = {date: from, startTime: "18:00", endDate: from, endTime: "19:00"};
function snapshot() {
  const collections = new Map<string, Map<string, any>>([
    ["weeklyMeetings", new Map([["meeting", {meetingDate: from, status: "open", section: "Cubs"}]])],
    ["events", new Map([["event", {startDate: from, endDate: from, status: "open", section: "Cubs"}]])],
    ["hall", new Map([["group", {ready: false, revision: 0}]])], ["siteSettings", new Map()]
  ]);
  return {collections, versions: new Map([["weeklyMeetings/meeting", "200:0"], ["events/event", "200:0"]]), creations: new Map([["weeklyMeetings/meeting", "100:0"], ["events/event", "100:0"]]), taskExists: new Set(), readVersion: "300:0", evidence: new Map(), reviewEvidence: new Map(), truncated: [], operator: [{active: true, role: "super-admin", sections: ["Cubs"]}, {active: true, scoutingRole: "Section Leader"}, {version: "redesigned", sdkRevision: 1}, {version: "redesigned"}, {kind: "leader", sourceId: uid}]};
}
const manifest = () => ({schemaVersion: 1, from, through, decisions: [{path: "weeklyMeetings/meeting", version: "200:0", resource: "group-hall", interval}, {path: "events/event", version: "200:0", resource: "none"}]});
const evidence = () => ({schemaVersion: 1, jira: "SW-561", environment: "emulator", project: "demo-hall-control", commit: "a".repeat(40), workerCommit: "a".repeat(40), verifiedAt: new Date(now - 1000).toISOString(), verifiedByUid: uid, evidenceUrl: "emulator://synthetic", passedChecks: [...HALL_ACCEPTANCE_CHECKS]});
test("a dry-run requires complete explicit facts and yields a digest without changing records or approval", async () => {
  const data = snapshot(), before = structuredClone(data), result = await planHallReconciliation(data, uid, manifest(), now);
  assert.equal(result.canApply, true, JSON.stringify(result.blockers)); assert.equal(result.activationApproved, false); assert.match(result.digest, /^[a-f0-9]{64}$/); assert.deepEqual(data, before);
  assert.deepEqual(result.items.map(item => item.action), ["reserve", "review-none"]);
  const stale = snapshot(); stale.versions.set("events/event", "201:0"); const changed = await planHallReconciliation(stale, uid, manifest(), now); assert.equal(changed.canApply, false); assert.notEqual(changed.digest, result.digest);
  assert.ok(changed.blockers.some(item => item.code === "hall/stale"));
});
test("manifest input rejects unknown fields, missing times, stale shapes, DST ambiguity and excessive horizon", () => {
  const base = manifest();
  for (const value of [{...base, extra: "private"}, {...base, through: "2028-01-01"}, {...base, decisions: [...base.decisions, base.decisions[0]]}, {...base, decisions: [{...base.decisions[0], interval: undefined}]}, {...base, decisions: [{...base.decisions[0], interval: {...interval, private: "secret"}}]}]) assert.throws(() => validateManifest(value));
  assert.throws(() => validateManifest({schemaVersion: 1, from: "2026-10-25", through: "2026-10-26", decisions: [{...base.decisions[0], interval: {date: "2026-10-25", startTime: "01:30", endDate: "2026-10-25", endTime: "03:00"}}]}));
});
test("proposed intervals conflict with one another while adjacent source imports remain valid", async () => {
  const base = manifest(); base.decisions[1] = {path: "events/event", version: "200:0", resource: "group-hall", interval} as any;
  const overlap = await planHallReconciliation(snapshot(), uid, base, now); assert.equal(overlap.canApply, false); assert.ok(overlap.blockers.some(item => item.code === "hall/conflict"));
  (base.decisions[1] as any).interval = {...interval, startTime: "19:00", endTime: "20:00"}; assert.equal((await planHallReconciliation(snapshot(), uid, base, now)).canApply, true);
});
test("Council and current Superuser are both required; rollout/readiness and revoked scope block staging", async () => {
  for (const change of ["non-superuser", "non-council", "inactive", "enabled", "ready"]) {
    const data = snapshot();
    if (change === "non-superuser") data.operator[0].role = "admin";
    if (change === "non-council") data.operator[1].scoutingRole = "Scouter";
    if (change === "inactive") data.operator[0].active = false;
    if (change === "enabled") data.collections.get("siteSettings")!.set("hallHire", {enabled: true});
    if (change === "ready") data.collections.get("hall")!.get("group").ready = true;
    await assert.rejects(planHallReconciliation(data, uid, manifest(), now));
  }
  assert.throws(() => importFields(manifest().decisions[0], {meetingDate: from, status: "closed"}, now));
  assert.throws(() => importFields(manifest().decisions[0], {meetingDate: from, status: "open", hallRevision: "bad"}));
});
test("server creation metadata defines the baseline; user-created timestamps cannot forge legacy review", async () => {
  const data = snapshot(); data.collections.get("hall")!.get("group").baselineVersion = "150:0";
  data.collections.get("events")!.get("event").createdAt = "2099-01-01";
  assert.equal(reviewedNonHall(data, "events/event", []), false);
  data.creations.set("events/event", "151:0"); assert.equal(reviewedNonHall(data, "events/event", []), true);
  assert.equal(afterVersion("150:1", "150:0"), true); assert.equal(afterVersion("bad", "150:0"), false);
  const report = await auditHallReservations(data, {from, through}); assert.ok(report.issues.some(item => item.code === "unconfirmed-source-use" && item.path === "weeklyMeetings/meeting"));
});
test("readiness requires fresh complete exact-deployment TEST attestation, never CI or emulator evidence for live TEST", () => {
  const build = {commit: "a".repeat(40), environment: "local"}; assert.doesNotThrow(() => assertTestEvidence(evidence(), "demo-hall-control", uid, build, now));
  for (const value of [{...evidence(), passedChecks: ["quality"]}, {...evidence(), verifiedAt: "2026-10-29T00:00:00.000Z"}, {...evidence(), workerCommit: "b".repeat(40)}, {...evidence(), verifiedByUid: "another"}]) assert.throws(() => assertTestEvidence(value, "demo-hall-control", uid, build, now));
  assert.throws(() => assertTestEvidence(evidence(), "coolock-ardlea-scouts-test", uid, build, now));
  const live = {...evidence(), environment: "firebase-test", project: "coolock-ardlea-scouts-test", evidenceUrl: "https://kfeeney1.atlassian.net/browse/SW-561?focusedCommentId=123"};
  assert.doesNotThrow(() => assertTestEvidence(live, live.project, uid, {...build, environment: "test", source: "github-actions", buildTime: "2026-10-31T11:00:00.000Z"}, now));
  assert.throws(() => assertTestEvidence(live, live.project, uid, {...build, environment: "test", source: "github-actions", buildTime: "2026-10-31T12:00:00.000Z"}, now));
});
test("control flags prevent Production mutations and unsigned emulator identity crossing into live TEST", () => {
  const env = {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"};
  assert.equal(hallControlOptions(["--mode=plan", "--project=demo-hall-control", "--manifest=/private/file"], env).mode, "plan");
  assert.throws(() => hallControlOptions(["--mode=apply", "--project=coolock-ardlea-scouts", "--manifest=/private/file", `--plan=${"a".repeat(64)}`], {}));
  assert.throws(() => hallControlOptions(["--mode=revoke", "--project=coolock-ardlea-scouts-test"], {FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"}));
  assert.throws(() => hallControlOptions(["--mode=apply", "--project=demo-hall-control", "--manifest=/private/file"], env));
});
test("live deployment metadata is fetched only from the fixed public TEST site and has a hard size bound", async () => {
  const seen: any[] = [];
  const build = await deployedTestBuild(evidence(), "coolock-ardlea-scouts-test", async (url: any, options: any) => {seen.push({url, options}); return Response.json({commit: "a".repeat(40), environment: "test"});});
  assert.equal(build.environment, "test"); assert.equal(seen[0].url, "https://coolock-ardlea-scouts-test.web.app/build-info.json"); assert.equal(seen[0].options.redirect, "error"); assert.equal(seen[0].options.headers, undefined);
  await assert.rejects(deployedTestBuild(evidence(), "coolock-ardlea-scouts-test", async () => new Response("x".repeat(4097))));
});
