import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";
import { smokeSpecs, suiteSpecs, suitesForChangedPath } from "./playwright-suites.mjs";
import { assignSpecsToShard, estimateSpecsSeconds } from "./playwright-shards.mjs";

const args = process.argv.slice(2);
const modeIndex = args.indexOf("--mode");
const baseIndex = args.indexOf("--base");
const suiteIndex = args.indexOf("--suite");
const shardIndex = args.indexOf("--shard");
const mode = modeIndex >= 0 ? args[modeIndex + 1] : "full";
const base = baseIndex >= 0 ? args[baseIndex + 1] : null;
const requestedSuite = suiteIndex >= 0 ? args[suiteIndex + 1] : null;
const shard = shardIndex >= 0 ? args[shardIndex + 1] : null;

function selectedForShard(specs) {
  if (!shard) return [...new Set(specs)];
  const match = /^(\d+)\/(\d+)$/.exec(shard);
  if (!match) {
    console.error(`Invalid Playwright shard: ${shard}; expected <index>/<count>.`);
    process.exit(2);
  }
  const shardNumber = Number(match[1]);
  const shardCount = Number(match[2]);
  const assigned = assignSpecsToShard(specs, shardNumber, shardCount);
  console.log(`Weighted shard ${shardNumber}/${shardCount}: ${assigned.length} specs, estimated ${estimateSpecsSeconds(assigned).toFixed(1)}s.`);
  return assigned;
}

function run(specs, label) {
  const selected = selectedForShard(specs);
  const unique = selected.map((name) => `e2e/${name}`);
  console.log(`Playwright selection: ${label}`);
  console.log(`Specs (${unique.length}): ${unique.join(", ")}`);
  if (unique.length === 0) {
    console.log("No specs assigned to this shard.");
    process.exit(0);
  }
  const result = spawnSync("npx", ["--no-install", "playwright", "test", ...unique], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  process.exit(result.status ?? 1);
}

if (mode === "full") {
  run(Object.values(suiteSpecs).flat(), "full suite");
}

if (mode === "suite") {
  const specs = suiteSpecs[requestedSuite];
  if (!specs) {
    console.error(`Unknown Playwright suite: ${requestedSuite}`);
    process.exit(2);
  }
  run(specs, requestedSuite);
}

if (mode !== "pr") {
  console.error(`Unknown Playwright mode: ${mode}`);
  process.exit(2);
}

if (!base) {
  console.error("PR mode requires --base <git-ref-or-sha>.");
  process.exit(2);
}

let changedFiles;
try {
  changedFiles = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
} catch (error) {
  console.error("Unable to determine changed files safely; running full Playwright suite.");
  console.error(error instanceof Error ? error.message : error);
  run(Object.values(suiteSpecs).flat(), "full-suite fallback");
}

const selectedSuites = new Set();
let requiresFullSuite = false;
for (const file of changedFiles) {
  const suites = suitesForChangedPath(file);
  if (suites === null) {
    requiresFullSuite = true;
    console.log(`Full-suite fallback triggered by: ${file}`);
    break;
  }
  for (const suite of suites) selectedSuites.add(suite);
}

if (requiresFullSuite) {
  run(Object.values(suiteSpecs).flat(), "full-suite fallback");
}

const selectedSpecs = [...smokeSpecs];
for (const suite of selectedSuites) selectedSpecs.push(...suiteSpecs[suite]);
run(selectedSpecs, `PR smoke + ${selectedSuites.size ? [...selectedSuites].join(", ") : "no affected functional suite"}`);
