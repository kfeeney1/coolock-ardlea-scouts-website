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
const selectLikeFiles = [];
for (const filename of await collect(srcRoot)) {
  const source = await readFile(filename, "utf8");
  const relative = path.relative(root, filename).replaceAll(path.sep, "/");
  const directSelect = /<Select(?:\s|>)/.test(source);
  const textFieldSelect = /<TextField\b[^>]*\bselect(?:\s|=|>)/s.test(source);
  const autocomplete = /<Autocomplete(?:\s|>)/.test(source);
  const nativeSelect = /<select(?:\s|>)/.test(source);

  if (directSelect && !allowedDirectSelects.has(relative)) {
    const traits = [
      /\bmultiple(?:\s|=|>)/.test(source) ? "multiple" : null,
      /\bMenuProps\s*=/.test(source) ? "custom MenuProps" : null,
      /\bopen\s*=/.test(source) ? "controlled open candidate" : null,
      /\bonOpen\s*=/.test(source) ? "custom onOpen" : null,
      /\bonClose\s*=/.test(source) ? "custom onClose" : null,
      /\brenderValue\s*=/.test(source) ? "renderValue" : null,
      /\bnative\s*=/.test(source) ? "native mode" : null
    ].filter(Boolean);
    directSelectFiles.push({ relative, traits });
  }

  if (textFieldSelect || autocomplete || nativeSelect) {
    selectLikeFiles.push({
      relative,
      kinds: [
        textFieldSelect ? "TextField select" : null,
        autocomplete ? "Autocomplete" : null,
        nativeSelect ? "native select" : null
      ].filter(Boolean)
    });
  }
}

directSelectFiles.sort((a, b) => a.relative.localeCompare(b.relative));
selectLikeFiles.sort((a, b) => a.relative.localeCompare(b.relative));
if (directSelectFiles.length > 0 || selectLikeFiles.length > 0) {
  if (directSelectFiles.length > 0) {
    console.error("Direct MUI Select inventory (migrate these to the shared stable dropdown implementation):");
    for (const entry of directSelectFiles) {
      console.error(`- ${entry.relative}${entry.traits.length ? ` [${entry.traits.join(", ")}]` : ""}`);
    }
  }
  if (selectLikeFiles.length > 0) {
    console.error("Other select-like controls requiring explicit audit:");
    for (const entry of selectLikeFiles) console.error(`- ${entry.relative} [${entry.kinds.join(", ")}]`);
  }
  process.exit(1);
}

console.log("Dropdown implementation contract OK: no unapproved direct or unaudited select-like controls remain.");
