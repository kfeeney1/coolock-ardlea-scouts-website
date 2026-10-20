import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const FIREBASE_RULES_MAX_ATTEMPTS = 4;
export const FIREBASE_RULES_BACKOFF_MS = Object.freeze([5_000, 15_000, 30_000]);

const FIREBASE_TOOLS_PACKAGE = "firebase-tools@15.28.1";
const RETRYABLE_ENDPOINTS = ["/test", "/rulesets"];

export function retryableFirebaseRulesEndpoint(output) {
  for (const line of String(output).split(/\r?\n/)) {
    if (!/firebaserules\.googleapis\.com/i.test(line) || !/\b503\b/.test(line)) continue;
    const endpoint = RETRYABLE_ENDPOINTS.find((path) => line.includes(path));
    if (endpoint) return endpoint;
  }
  return null;
}

export async function deployFirebaseTargetsInOrder({ deployRules, deployRemainingTargets }) {
  await deployRules();
  await deployRemainingTargets();
}

export async function deployFirebaseRulesWithRetry({
  run,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  log = (message) => console.log(message),
  maxAttempts = FIREBASE_RULES_MAX_ATTEMPTS,
  backoffMs = FIREBASE_RULES_BACKOFF_MS,
}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError("maxAttempts must be a positive integer");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await run();
    if (result.code === 0) {
      log(`Firebase Rules validation and deployment succeeded on attempt ${attempt}/${maxAttempts}.`);
      return;
    }

    const endpoint = retryableFirebaseRulesEndpoint(result.output);
    if (!endpoint) {
      throw new Error(`Firebase Rules deployment failed on attempt ${attempt}/${maxAttempts} with exit code ${result.code}; failure is not a retryable Firebase Rules API HTTP 503.`);
    }

    if (attempt === maxAttempts) {
      throw new Error(`Firebase Rules deployment failed after ${attempt}/${maxAttempts} attempts: HTTP 503 from Firebase Rules API ${endpoint}.`);
    }

    const delay = backoffMs[Math.min(attempt - 1, backoffMs.length - 1)];
    log(`Firebase Rules API ${endpoint} returned HTTP 503 on attempt ${attempt}/${maxAttempts}; retrying in ${delay / 1_000}s (attempt ${attempt + 1}/${maxAttempts}).`);
    await sleep(delay);
  }
}

function runNpx(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const append = (chunk) => {
      const text = chunk.toString();
      output = `${output}${text}`.slice(-64_000);
      return text;
    };

    child.stdout.on("data", (chunk) => process.stdout.write(append(chunk)));
    child.stderr.on("data", (chunk) => process.stderr.write(append(chunk)));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

function firebaseDeployArgs(targets) {
  return [
    "--yes",
    FIREBASE_TOOLS_PACKAGE,
    "deploy",
    "--config",
    "firebase.test.json",
    "--only",
    targets,
    "--project",
    "coolock-ardlea-scouts-test",
    "--non-interactive",
  ];
}

export async function deployFirebaseTest({ run = runNpx, sleep, log } = {}) {
  await deployFirebaseTargetsInOrder({
    deployRules: () => deployFirebaseRulesWithRetry({
      run: () => run(firebaseDeployArgs("firestore:rules")),
      sleep,
      log,
    }),
    deployRemainingTargets: async () => {
      const result = await run(firebaseDeployArgs("firestore:indexes,storage:test-default,hosting,functions:maintenance"));
      if (result.code !== 0) {
        throw new Error(`Firebase TEST indexes, Storage rules, and Hosting deployment failed with exit code ${result.code}.`);
      }
      (log ?? console.log)("Firebase TEST indexes, Storage rules, and Hosting deployment succeeded.");
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  deployFirebaseTest().catch((error) => {
    console.error(`Firebase TEST deployment failed: ${error.message}`);
    process.exitCode = 1;
  });
}
