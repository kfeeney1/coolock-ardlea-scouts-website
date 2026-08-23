import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const ROOTS = ["src/services", "scripts"];
const WRITER_MARKERS = [
  /collection\([^)]+["']publicLeadership["']/,
  /doc\([^)]+["']publicLeadership["']/,
  /collection\(["']publicLeadership["']\)/,
  /doc\(["']publicLeadership["']\)/
];
const WRITE_MARKERS = [/\.set\(/, /setDoc\(/, /batch\.set\(/];

async function filesUnder(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(full));
    else if (/\.(?:ts|tsx|mjs|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

describe("publicLeadership projection writers", () => {
  it("all active writers stamp the current fail-closed contract", async () => {
    const files = (await Promise.all(ROOTS.map(filesUnder))).flat();
    const writers: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      const referencesPublicLeadership = WRITER_MARKERS.some((pattern) => pattern.test(source));
      const writesDocuments = WRITE_MARKERS.some((pattern) => pattern.test(source));
      if (!referencesPublicLeadership || !writesDocuments) continue;

      writers.push(file);
      assert.match(source, /publicProjectionVersion\s*:/, `${file} writes publicLeadership without publicProjectionVersion`);
      assert.match(source, /sourceAccessRole\s*:\s*["']leader["']/, `${file} writes publicLeadership without sourceAccessRole: leader`);
    }

    assert.ok(writers.length >= 4, `Expected to discover all active publicLeadership writers, found ${writers.length}: ${writers.join(", ")}`);
  });
});
