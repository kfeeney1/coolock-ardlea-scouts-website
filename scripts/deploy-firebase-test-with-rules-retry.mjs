import { spawn } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { reportFirebaseRulesFailure } from "./firebase-rules-failure-diagnostics.mjs";

import { publishTestRules, deliveryConfig } from "./publish-test-rules.mjs";

const FIREBASE_TOOLS_PACKAGE = "firebase-tools@15.28.1";

async function runNpx(args) {
  // Prevent an earlier attempt's diagnostics being attributed to this one.
  await rm("firebase-debug.log", { force: true });
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
    child.on("close", async (code) => {
      if (code !== 0) await reportFirebaseRulesFailure();
      resolve({ code: code ?? 1, output });
    });
  });
}

function firebaseDeployArgs(targets, configPath) {
  return [
    "--yes",
    FIREBASE_TOOLS_PACKAGE,
    "deploy",
    "--config",
    configPath,
    "--only",
    targets,
    "--project",
    "coolock-ardlea-scouts-test",
    "--non-interactive",
  ];
}

export async function deployFirebaseTest({ run = runNpx, publishRules = publishTestRules, log = console.log } = {}) {
  // Both Rules releases must be verified before indexes or Hosting can change.
  await publishRules();
  const configPath = `firebase.test.delivery-${process.pid}.json`;
  const config = deliveryConfig(JSON.parse(await readFile("firebase.test.json", "utf8")));
  await writeFile(configPath, JSON.stringify(config), { flag: "wx", mode: 0o600 });
  try {
    const result = await run(firebaseDeployArgs("firestore:indexes,hosting", configPath));
    if (result.code !== 0) throw new Error(`Firebase TEST indexes and Hosting deployment failed with exit code ${result.code}.`);
    log("Firebase TEST Rules verified; indexes and Hosting deployment succeeded.");
  } finally {
    await rm(configPath, { force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  deployFirebaseTest().catch((error) => {
    console.error(`Firebase TEST deployment failed: ${error.message}`);
    process.exitCode = 1;
  });
}
