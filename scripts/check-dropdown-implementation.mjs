import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const allowedSelectPrimitiveImports = new Set([
  "src/components/SectionIdentityControls.tsx",
  "src/components/StableSelect.tsx"
]);
const allowedTextFieldPrimitiveImports = new Set([
  "src/components/StableTextField.tsx"
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
let selectMarkupCount = 0;
let textFieldSelectCount = 0;
for (const filename of await collect(srcRoot)) {
  const source = await readFile(filename, "utf8");
  const relative = path.relative(root, filename).replaceAll(path.sep, "/");

  if (/<Select(?:\s|>)/.test(source)) selectMarkupCount += 1;
  if (/<TextField\b[^>]*\bselect(?:\s|=|>)/s.test(source)) textFieldSelectCount += 1;

  if (/from\s+["']@mui\/material\/Select(?:\.js)?["']/.test(source) && !allowedSelectPrimitiveImports.has(relative)) {
    violations.push(`${relative}: bypasses StableSelect via a direct @mui/material/Select import`);
  }
  if (/from\s+["']@mui\/material\/TextField(?:\.js)?["']/.test(source) && !allowedTextFieldPrimitiveImports.has(relative)) {
    violations.push(`${relative}: bypasses StableTextField via a direct @mui/material/TextField import`);
  }
  if (/<select(?:\s|>)/.test(source)) {
    violations.push(`${relative}: native <select> requires explicit stable-dropdown review`);
  }
  if (/<Autocomplete(?:\s|>)/.test(source)) {
    violations.push(`${relative}: Autocomplete requires explicit popup-geometry review`);
  }
}

const proxy = await readFile(path.join(srcRoot, "mui-material.ts"), "utf8");
if (!/export \{ default as Select \} from ["']\.\/components\/StableSelect["']/.test(proxy)) {
  violations.push("src/mui-material.ts: Select is not routed through StableSelect");
}
if (!/export \{ default as TextField \} from ["']\.\/components\/StableTextField["']/.test(proxy)) {
  violations.push("src/mui-material.ts: TextField is not routed through StableTextField");
}

const viteConfig = await readFile(path.join(root, "vite.config.ts"), "utf8");
if (!/find:\s*\/\^@mui\\\/material\$\//.test(viteConfig) || !/src\/mui-material\.ts/.test(viteConfig)) {
  violations.push("vite.config.ts: exact @mui/material runtime alias is missing");
}

const tsConfig = await readFile(path.join(root, "tsconfig.app.json"), "utf8");
if (!/"@mui\/material"\s*:\s*\[\s*"src\/mui-material\.ts"\s*\]/.test(tsConfig)) {
  violations.push("tsconfig.app.json: @mui/material typecheck path is not routed through the app proxy");
}

if (violations.length > 0) {
  console.error("Dropdown implementation contract failed:");
  for (const violation of violations.sort()) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Dropdown implementation contract OK: ${selectMarkupCount} Select source files and ${textFieldSelectCount} TextField-select source files route through the stable app boundary.`);
