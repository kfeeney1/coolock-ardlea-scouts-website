import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";
import { requireFirebaseMutationTarget } from "./firebase-operation-guard.mjs";
import { rulesCompilerReason } from "./publish-test-rules.mjs";

const samples = [
  ["Last successful production source", "dabd334b78899076acec1b1c6f1efc94dd54ac9b"],
  ["Previously published TEST source", "89eae97811a83d256968485b5fd223adb4fd0787"],
  ["Failing #993 source", "b1d3d411b2b9fd00d5f3f9a7e83a3c805854c3aa"],
];

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const target = requireFirebaseMutationTarget({ operation: "probe-test-firestore-compiler", credentialJson: raw });
if (target.environment !== "test" || target.credentialProjectId !== target.projectId) {
  throw new Error("The probe requires explicit Firebase TEST credentials.");
}

const sources = samples.map(([label, sha]) => ({
  label,
  sha,
  content: execFileSync("git", ["show", `${sha}:firestore.rules`], { encoding: "utf8" }),
}));

function status(error) {
  const code = error.httpResponse?.status;
  return Number.isInteger(code) ? code : "unavailable";
}

const app = initializeApp({ credential: cert(JSON.parse(raw)), projectId: target.projectId });
try {
  const rules = getSecurityRules(app);
  for (const { label, sha, content } of sources) {
    const digest = createHash("sha256").update(content).digest("hex");
    console.log(`${label}: commit=${sha}, source SHA-256=${digest}`);
    const started = performance.now();
    let ruleset;
    try {
      ruleset = await rules.createRuleset({ name: "firestore.rules", content });
    } catch (error) {
      const elapsed = Math.round(performance.now() - started);
      console.error(`Compile failed after ${elapsed} ms (HTTP ${status(error)}; ${rulesCompilerReason(error)}).`);
      process.exitCode = 1;
      continue;
    }
    console.log(`Compile succeeded after ${Math.round(performance.now() - started)} ms.`);
    try {
      await rules.deleteRuleset(ruleset.name);
      console.log("Unreleased ruleset deleted.");
    } catch (error) {
      console.error(`Cleanup failed for unreleased ruleset ${ruleset.name} (HTTP ${status(error)}).`);
      process.exitCode = 1;
    }
  }
} finally {
  await deleteApp(app);
}
