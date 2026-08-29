import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const TARGETS = ["src/pages", "src/components", "src/services", "e2e"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const BASELINE_PATH = join(ROOT, "scripts/source-complexity-baseline.json");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = Math.max(1, Number(limitArg?.split("=")[1] || 20));
const check = process.argv.includes("--check");

function walk(directory) {
  const absolute = join(ROOT, directory);
  const entries = [];
  for (const name of readdirSync(absolute)) {
    const full = join(absolute, name);
    const stat = statSync(full);
    if (stat.isDirectory()) entries.push(...walk(relative(ROOT, full)));
    else if (SOURCE_EXTENSIONS.has(extname(full))) entries.push(full);
  }
  return entries;
}

const allRows = TARGETS
  .flatMap(walk)
  .map((full) => {
    const content = readFileSync(full, "utf8");
    return {
      path: relative(ROOT, full).replaceAll("\\", "/"),
      bytes: Buffer.byteLength(content),
      lines: content.split("\n").length
    };
  })
  .sort((a, b) => b.bytes - a.bytes || b.lines - a.lines);

const rows = allRows.slice(0, limit);
const pathWidth = Math.max("Path".length, ...rows.map((row) => row.path.length));
console.log(`Largest ${rows.length} TypeScript/TSX source files by byte size:`);
console.log(`${"Path".padEnd(pathWidth)}  ${"Bytes".padStart(8)}  ${"Lines".padStart(6)}`);
console.log(`${"-".repeat(pathWidth)}  ${"-".repeat(8)}  ${"-".repeat(6)}`);
for (const row of rows) {
  console.log(`${row.path.padEnd(pathWidth)}  ${String(row.bytes).padStart(8)}  ${String(row.lines).padStart(6)}`);
}

if (!check) {
  console.log("\nThis report is informational. File size alone is not a refactoring requirement; use --check to enforce the recorded regression guard.");
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const thresholdBytes = Number(baseline.thresholdBytes);
const growthAllowanceBytes = Number(baseline.growthAllowanceBytes);
const knownLargeFiles = baseline.knownLargeFiles ?? {};

if (!Number.isFinite(thresholdBytes) || thresholdBytes < 1) {
  throw new Error("source-complexity-baseline.json thresholdBytes must be a positive number.");
}
if (!Number.isFinite(growthAllowanceBytes) || growthAllowanceBytes < 0) {
  throw new Error("source-complexity-baseline.json growthAllowanceBytes must be a non-negative number.");
}

const rowByPath = new Map(allRows.map((row) => [row.path, row]));
const violations = [];

for (const row of allRows) {
  if (row.bytes <= thresholdBytes) continue;
  const recordedBytes = knownLargeFiles[row.path];
  if (!Number.isFinite(recordedBytes)) {
    violations.push(`${row.path}: ${row.bytes} bytes exceeds ${thresholdBytes} without a reviewed baseline entry`);
    continue;
  }
  const maximum = recordedBytes + growthAllowanceBytes;
  if (row.bytes > maximum) {
    violations.push(`${row.path}: ${row.bytes} bytes exceeds reviewed baseline ${recordedBytes} + ${growthAllowanceBytes} allowance`);
  }
}

for (const [path, recordedBytes] of Object.entries(knownLargeFiles)) {
  if (!Number.isFinite(recordedBytes) || recordedBytes < 1) {
    violations.push(`${path}: baseline size must be a positive number`);
    continue;
  }
  const row = rowByPath.get(path);
  if (!row) violations.push(`${path}: reviewed baseline entry no longer resolves to a tracked TypeScript/TSX file`);
}

if (violations.length) {
  console.error("\nSource-complexity regression guard failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error("\nReduce the new growth or deliberately update scripts/source-complexity-baseline.json with architectural review context.");
  process.exit(1);
}

console.log(`\nSource-complexity regression guard passed. New files must stay at or below ${thresholdBytes} bytes unless explicitly reviewed; known large files have a ${growthAllowanceBytes}-byte growth allowance.`);
