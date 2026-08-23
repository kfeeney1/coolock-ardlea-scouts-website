import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const ROOTS = ["src/services", "scripts"];
const PUBLIC_WRITER_MARKERS = [
  /collection\([^)]+["']publicLeadership["']/,
  /doc\([^)]+["']publicLeadership["']/,
  /collection\(["']publicLeadership["']\)/,
  /doc\(["']publicLeadership["']\)/,
  /upsert\(["']publicLeadership["']/
];
const WRITE_MARKERS = [/\.set\(/, /setDoc\(/, /batch\.set\(/, /transaction\.set\(/, /updateDoc\(/];
const SECTION_WRITER_FILES = [
  "scripts/seed-test-data.mjs",
  "scripts/seed-population-data.mjs",
  "scripts/seed-e2e-auth-users.mjs",
  "src/services/leaderAccess.ts",
  "src/services/leaderProfile.ts",
  "src/services/leaderRegistrations.ts"
];

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

async function activeSourceFiles(): Promise<Array<{ file: string; source: string }>> {
  const files = (await Promise.all(ROOTS.map(filesUnder))).flat();
  return Promise.all(files.map(async (file) => ({ file, source: await readFile(file, "utf8") })));
}

describe("leadership data writers", () => {
  it("all active publicLeadership writers stamp the current fail-closed contract", async () => {
    const writers: string[] = [];

    for (const { file, source } of await activeSourceFiles()) {
      const referencesPublicLeadership = PUBLIC_WRITER_MARKERS.some((pattern) => pattern.test(source));
      const writesDocuments = WRITE_MARKERS.some((pattern) => pattern.test(source));
      if (!referencesPublicLeadership || !writesDocuments) continue;

      writers.push(file);
      assert.match(source, /publicProjectionVersion\s*:/, `${file} writes publicLeadership without publicProjectionVersion`);
      assert.match(source, /sourceAccessRole\s*:\s*["']leader["']/, `${file} writes publicLeadership without sourceAccessRole: leader`);
    }

    assert.ok(writers.length >= 5, `Expected to discover all active publicLeadership writers, found ${writers.length}: ${writers.join(", ")}`);
  });

  it("known leader section writers keep sections[] and compatibility section synchronized", async () => {
    for (const file of SECTION_WRITER_FILES) {
      const source = await readFile(file, "utf8");
      assert.match(source, /\bsections\s*:/, `${file} writes leader sections without canonical sections[]`);
      assert.match(source, /\bsection\s*:/, `${file} writes leader sections without compatibility section`);
    }
  });
});
