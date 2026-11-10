import { execFileSync } from "node:child_process";
import { compileRulesSource, readCommittedRules, rulesSourceDigest } from "./reviewed-rules-source.mjs";
import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";
import { requireFirebaseMutationTarget } from "./firebase-operation-guard.mjs";
import { rulesCompilerReason } from "./publish-test-rules.mjs";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trimEnd();
}

const knownGood = "dabd334b78899076acec1b1c6f1efc94dd54ac9b";
const lastFailed = "ca2ee1a076cb119144aa43b109ce7d4e0d124a74";
const control = ["Last successful production source", knownGood, true];

function historySamples() {
  // Compare every first-parent Rules change in the observed failure interval.
  // A binary search would miss recoveries if failures are intermittent.
  const history = git("log", "--first-parent", "--reverse", "--format=%H %s",
    `${knownGood}..${lastFailed}`, "--", "firestore.rules");
  const checkpoints = history.split("\n");
  if (checkpoints.length !== 12 || !checkpoints.at(-1).startsWith(`${lastFailed} `)) {
    throw new Error("The expected Firestore Rules comparison history is unavailable.");
  }
  return [control, ...checkpoints.map((line) => [line.slice(41), line.slice(0, 40)])];
}

function appointmentSamples() {
  const before = "1829245312cad835682e06fbe4583f4b61e20c2a";
  const after = "d0cf40cba39719b022194c257f9a57ce47f30f22";
  return [
    ["Before #981 (control)", before, true],
    ["Full #981", after],
    ["#981 appointment lookup only", after, false, before],
    ["#981 delegated writes only", before, false, after],
  ];
}

function selectSamples(comparison) {
  if (comparison === "appointments") return appointmentSamples();
  if (comparison === "history") return historySamples();
  if (comparison !== "current") throw new Error("Unknown Firestore compiler comparison.");
  return [
    ["Current main source", git("rev-parse", "HEAD"), true],
    control,
    ["Previously published TEST source", "89eae97811a83d256968485b5fd223adb4fd0787"],
    ["Failing #993 source", "b1d3d411b2b9fd00d5f3f9a7e83a3c805854c3aa"],
  ];
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const target = requireFirebaseMutationTarget({ operation: "probe-test-firestore-compiler", credentialJson: raw });
if (target.environment !== "test" || target.credentialProjectId !== target.projectId) {
  throw new Error("The probe requires explicit Firebase TEST credentials.");
}

const comparison = process.env.FIRESTORE_PROBE_COMPARISON || "current";
function readRules(sha) {
  return readCommittedRules(sha).toString("utf8");
}

function delegationMatch(source) {
  const start = "    match /organisationLeadership/{leaderId} {";
  const next = "    match /publicLeadership/{leaderId} {";
  const from = source.indexOf(start);
  const to = source.indexOf(next, from);
  if (from < 0 || to <= from || source.lastIndexOf(start) !== from || source.lastIndexOf(next) !== to) {
    throw new Error("Cannot isolate the organisationLeadership match.");
  }
  return source.slice(from, to);
}

const sources = selectSamples(comparison).map(([label, sha, required = false, delegationSha]) => {
  const source = readRules(sha);
  // #981 changed delegated writes only within this match. Swap it in memory
  // for the two diagnostic variants, which must never be released.
  const content = delegationSha
    ? source.replace(delegationMatch(source), () => delegationMatch(readRules(delegationSha)))
    : source;
  return { label, sha, required, delegationSha, content };
});

function status(error) {
  const code = error.httpResponse?.status;
  return Number.isInteger(code) ? code : "unavailable";
}

const results = [];
const app = initializeApp({ credential: cert(JSON.parse(raw)), projectId: target.projectId });
try {
  const rules = getSecurityRules(app);
  for (const { label, sha, content, required, delegationSha } of sources) {
    const digest = rulesSourceDigest(content);
    const revision = delegationSha ? `base=${sha}, delegation=${delegationSha}` : `commit=${sha}`;
    console.log(`${label}: ${revision}, source SHA-256=${digest}`);
    const started = performance.now();
    let ruleset;
    try {
      ruleset = await compileRulesSource(rules, { name: "firestore.rules", content });
    } catch (error) {
      const elapsed = Math.round(performance.now() - started);
      console.error(`Compile failed after ${elapsed} ms (HTTP ${status(error)}; ${rulesCompilerReason(error)}).`);
      results.push({ sha, label, result: `HTTP ${status(error)}` });
      if (required) process.exitCode = 1;
      continue;
    }
    results.push({ sha, label, result: "compiled" });
    console.log(`Compile succeeded after ${Math.round(performance.now() - started)} ms.`);
    try {
      await rules.deleteRuleset(ruleset.name);
      console.log("Unreleased ruleset deleted.");
    } catch (error) {
      console.error(`Cleanup failed for unreleased ruleset ${ruleset.name} (HTTP ${status(error)}).`);
      process.exitCode = 1;
    }
  }
  console.table(results);
} finally {
  await deleteApp(app);
}
