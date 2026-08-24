import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const ROOTS = ["src/services", "scripts"];
const PUBLIC_WRITE_MARKERS = [
  /(?:collection|doc)\([^)]*["']publicLeadership["'][^;]{0,400}\.set\(/s,
  /(?:setDoc|updateDoc|batch\.set|transaction\.set)\([^;]{0,400}["']publicLeadership["']/s,
  /replace\(["']publicLeadership["']/,
  /upsert\(["']publicLeadership["']/
];
const CANONICAL_SECTION_WRITER_FILES = [
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

function firestoreWriteObjects(source: string): string[] {
  const writes: string[] = [];
  const pattern = /(?:setDoc|updateDoc|addDoc|batch\.set|transaction\.set)\([^,]+,\s*\{([\s\S]*?)\}\s*(?:,\s*\{[^}]*\})?\s*\)/g;
  for (const match of source.matchAll(pattern)) writes.push(match[1]);
  return writes;
}

describe("leadership data writers", () => {
  it("all active publicLeadership writers stamp the current fail-closed contract", async () => {
    const writers: string[] = [];

    for (const { file, source } of await activeSourceFiles()) {
      const writesPublicLeadership = PUBLIC_WRITE_MARKERS.some((pattern) => pattern.test(source));
      if (!writesPublicLeadership) continue;

      writers.push(file);
      assert.match(source, /publicProjectionVersion\s*:/, `${file} writes publicLeadership without publicProjectionVersion`);
      assert.match(source, /sourceAccessRole\s*:\s*["']leader["']/, `${file} writes publicLeadership without sourceAccessRole: leader`);
    }

    assert.deepEqual(
      writers.sort(),
      [
        "scripts/rebuild-public-leadership.mjs",
        "scripts/seed-population-data.mjs",
        "src/services/organisationChart.ts"
      ],
      `Unexpected publicLeadership writer set: ${writers.join(", ")}`
    );
  });

  it("canonical leader section writers use sections[] and never persist legacy section", async () => {
    for (const file of CANONICAL_SECTION_WRITER_FILES) {
      const source = await readFile(file, "utf8");
      assert.match(source, /\bsections\s*:/, `${file} does not write canonical sections[]`);
      for (const writeObject of firestoreWriteObjects(source)) {
        assert.doesNotMatch(writeObject, /\bsection\s*:/, `${file} still persists legacy singular section`);
      }
    }

    const seedFile = "scripts/seed-population-data.mjs";
    const seedSource = await readFile(seedFile, "utf8");
    const adminPayload = seedSource.match(/replace\(["']adminUsers["'],\s*user\.uid,\s*\{([\s\S]*?)\}\s*\);/);
    assert.ok(adminPayload, `${seedFile} must contain an explicit adminUsers seed payload`);
    assert.match(adminPayload[1], /\bsections\s*:\s*user\.sections/, `${seedFile} does not write canonical sections[] to adminUsers`);
    assert.doesNotMatch(adminPayload[1], /\bsection\s*:/, `${seedFile} writes legacy singular section to adminUsers`);
  });
});
