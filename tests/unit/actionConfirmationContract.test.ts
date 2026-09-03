import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const sourceRoot = path.resolve("src");
const browserNativeDialogPattern = /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

test("application source contains no browser-native alert, confirm or prompt calls", () => {
  const violations: Array<{ file: string; dialog: string; offset: number }> = [];

  for (const file of sourceFiles(sourceRoot)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(browserNativeDialogPattern)) {
      violations.push({
        file: path.relative(process.cwd(), file),
        dialog: match[0],
        offset: match.index
      });
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Use accessible in-app feedback/confirmation instead of browser-native dialogs:\n${violations.map((violation) => `${violation.file}:${violation.offset} ${violation.dialog}`).join("\n")}`
  );
});
