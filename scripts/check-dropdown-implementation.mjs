import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const allowedDirectSelects = new Set([
  "src/components/SectionIdentityControls.tsx"
]);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(fullPath)));
    else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const directSelectFiles = [];
for (const filename of await collect(srcRoot)) {
  const source = await readFile(filename, "utf8");
  if (!/<Select(?:\s|>)/.test(source)) continue;
  const relative = path.relative(root, filename).replaceAll(path.sep, "/");
  if (!allowedDirectSelects.has(relative)) directSelectFiles.push(relative);
}

directSelectFiles.sort();
if (directSelectFiles.length > 0) {
  console.error("Direct MUI Select inventory (migrate these to the shared stable dropdown implementation):");
  for (const filename of directSelectFiles) console.error(`- ${filename}`);
  process.exit(1);
}

console.log("Dropdown implementation contract OK: no unapproved direct MUI Select usage remains.");
