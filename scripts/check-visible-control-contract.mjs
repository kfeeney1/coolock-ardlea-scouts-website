import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  }));
  return nested.flat();
}

const files = await sourceFiles(join(root, "src"));
for (const file of files) {
  const source = await readFile(file, "utf8");
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (/variant\s*=\s*["']text["']/.test(line) && !/data-control-role\s*=\s*["']menu["']/.test(line)) {
      failures.push(`${file}:${index + 1}: text-variant control must be a standard menu or use a visible button variant`);
    }
  });
  if (/<Link(?:\s|>)/.test(source)) failures.push(`${file}: use ActionLinkButton for visible content navigation instead of a text-only MUI Link`);
  if (/<a\b(?=[^>]*\bhref\s*=)/.test(source)) failures.push(`${file}: raw JSX anchors must use visible shared link-button presentation`);
  if (/<Typography\b[^>]*component=["']a["']/.test(source)) failures.push(`${file}: telephone/contact navigation must use a visible link-button`);
}

const theme = await readFile(join(root, "src/theme/theme.ts"), "utf8");
const containedDefaults = theme.match(/MuiButton:\s*\{\s*defaultProps:\s*\{\s*variant:\s*["']contained["']/g) ?? [];
if (containedDefaults.length !== 3) failures.push("src/theme/theme.ts: all three site theme systems must default actions to filled presentation");
if (!theme.includes("outlined: filledOutlinedButton") || !theme.includes("backgroundColor: palette.main") || !theme.includes("color: palette.contrastText")) {
  failures.push("src/theme/theme.ts: explicitly outlined action buttons must receive a filled, high-contrast appearance");
}
const linkButton = await readFile(join(root, "src/components/ActionLinkButton.tsx"), "utf8");
if (!linkButton.includes('variant="contained"')) failures.push("src/components/ActionLinkButton.tsx: navigation and contact links must use filled link-button presentation");

const audience = await readFile(join(root, "src/components/admin/EventAudienceBuilder.tsx"), "utf8");
for (const label of ["Select all authorized sections", "Clear sections"]) {
  const line = audience.split("\n").find((item) => item.includes(label));
  if (!line || !/type="button"/.test(line) || !/variant="contained"/.test(line)) {
    failures.push(`src/components/admin/EventAudienceBuilder.tsx: ${label} must remain a semantic, filled button`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Visible-control contract passed across ${files.length} rendered TSX source files.`);
}
