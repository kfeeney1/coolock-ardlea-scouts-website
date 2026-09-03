import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const sourceRoot = path.resolve("src");
const browserNativeDialogPattern = /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/g;
const allowedLegacyDialogs = new Map([
  ["src/pages/BadgeworkTracking.tsx|window.confirm(", 2]
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

test("browser-native dialog usage cannot grow beyond the audited Stage 20.5 legacy baseline", () => {
  const observed = new Map<string, number>();
  const violations: Array<{ file: string; dialog: string; offset: number }> = [];

  for (const file of sourceFiles(sourceRoot)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(browserNativeDialogPattern)) {
      const relativeFile = path.relative(process.cwd(), file);
      const key = `${relativeFile}|${match[0]}`;
      observed.set(key, (observed.get(key) || 0) + 1);
      if (!allowedLegacyDialogs.has(key)) {
        violations.push({ file: relativeFile, dialog: match[0], offset: match.index });
      }
    }
  }

  for (const [key, expectedCount] of allowedLegacyDialogs) {
    const actualCount = observed.get(key) || 0;
    assert.ok(
      actualCount <= expectedCount,
      `Browser-native dialog baseline grew for ${key}: expected at most ${expectedCount}, found ${actualCount}.`
    );
  }

  assert.deepEqual(
    violations,
    [],
    `Use accessible in-app feedback/confirmation instead of adding browser-native dialogs:\n${violations.map((violation) => `${violation.file}:${violation.offset} ${violation.dialog}`).join("\n")}`
  );
});
