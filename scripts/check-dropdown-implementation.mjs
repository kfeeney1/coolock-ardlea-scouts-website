import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const directSelectPrimitiveAllowlist = new Set([
  "src/components/SectionIdentityControls.tsx",
  "src/components/StableSelect.tsx"
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

const violations = [];
let barrelSelectFileCount = 0;
let textFieldSelectFileCount = 0;
for (const filename of await collect(srcRoot)) {
  const source = await readFile(filename, "utf8");
  const relative = path.relative(root, filename).replaceAll(path.sep, "/");
  const hasSelectMarkup = /<Select(?:\s|>)/.test(source);
  const hasTextFieldSelect = /<TextField\b[^>]*\bselect(?:\s|=|>)/s.test(source);
  const directSelectPrimitive = /from\s+["']@mui\/material\/Select(?:\.js)?["']/.test(source);
  const muiBarrelImport = source.match(/import\s*\{([\s\S]*?)\}\s*from\s*["']@mui\/material["'];?/g) ?? [];
  const importsPlainSelectFromBarrel = muiBarrelImport.some((statement) => /(?:^|[,{\s])Select(?:\s*[},]|\s*,)/.test(statement));
  const aliasesSelectFromBarrel = muiBarrelImport.some((statement) => /\bSelect\s+as\s+/.test(statement));

  if (directSelectPrimitive && !directSelectPrimitiveAllowlist.has(relative)) {
    violations.push(`${relative}: unreviewed direct @mui/material/Select import bypasses site-wide routing`);
  }
  if (aliasesSelectFromBarrel) {
    violations.push(`${relative}: aliased MUI Select import cannot be safely rewritten by the stable-select Vite transform`);
  }
  if (hasSelectMarkup && !directSelectPrimitiveAllowlist.has(relative)) {
    barrelSelectFileCount += 1;
    if (!importsPlainSelectFromBarrel) {
      violations.push(`${relative}: Select markup is not backed by the audited plain MUI Select barrel import`);
    }
  }
  if (hasTextFieldSelect) textFieldSelectFileCount += 1;
  if (/from\s+["']@mui\/material\/TextField(?:\.js)?["']/.test(source)) {
    violations.push(`${relative}: direct TextField primitive import bypasses theme-level stable select slots`);
  }
  if (/<select(?:\s|>)/.test(source)) {
    violations.push(`${relative}: native <select> requires explicit stable-dropdown review`);
  }
  if (/<Autocomplete(?:\s|>)/.test(source)) {
    violations.push(`${relative}: Autocomplete requires explicit popup-geometry review`);
  }
}

const viteConfig = await readFile(path.join(root, "vite.config.ts"), "utf8");
if (!/name:\s*["']stable-select-imports["']/.test(viteConfig)
  || !/import Select from ["']\/src\/components\/StableSelect\.tsx["']/.test(viteConfig)
  || !/specifier === ["']Select["']/.test(viteConfig)) {
  violations.push("vite.config.ts: site-wide MUI Select runtime rewrite is missing or incomplete");
}

const themeSource = await readFile(path.join(srcRoot, "theme", "theme.ts"), "utf8");
const stableTextFieldSlotCount = (themeSource.match(/slots:\s*\{\s*select:\s*StableSelect\s*\}/g) ?? []).length;
if (stableTextFieldSlotCount < 2) {
  violations.push("src/theme/theme.ts: both visual themes must route TextField selects through StableSelect");
}

if (violations.length > 0) {
  console.error("Dropdown implementation contract failed:");
  for (const violation of violations.sort()) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Dropdown implementation contract OK: ${barrelSelectFileCount} MUI Select source files are rewritten through StableSelect and ${textFieldSelectFileCount} TextField-select source files inherit StableSelect from both themes.`);
