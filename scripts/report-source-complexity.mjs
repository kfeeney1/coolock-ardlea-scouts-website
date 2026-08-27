import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const TARGETS = ["src/pages", "src/components", "src/services", "e2e"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = Math.max(1, Number(limitArg?.split("=")[1] || 20));

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

const rows = TARGETS
  .flatMap(walk)
  .map((full) => {
    const content = readFileSync(full, "utf8");
    return {
      path: relative(ROOT, full).replaceAll("\\", "/"),
      bytes: Buffer.byteLength(content),
      lines: content.split("\n").length
    };
  })
  .sort((a, b) => b.bytes - a.bytes || b.lines - a.lines)
  .slice(0, limit);

const pathWidth = Math.max("Path".length, ...rows.map((row) => row.path.length));
console.log(`Largest ${rows.length} TypeScript/TSX source files by byte size:`);
console.log(`${"Path".padEnd(pathWidth)}  ${"Bytes".padStart(8)}  ${"Lines".padStart(6)}`);
console.log(`${"-".repeat(pathWidth)}  ${"-".repeat(8)}  ${"-".repeat(6)}`);
for (const row of rows) {
  console.log(`${row.path.padEnd(pathWidth)}  ${String(row.bytes).padStart(8)}  ${String(row.lines).padStart(6)}`);
}

console.log("\nThis report is informational. Stage 11 uses it to identify decomposition candidates; file size alone is not a refactoring requirement.");
