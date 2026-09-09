import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function privateManifestPath(): { dir: string; manifest: string } {
  const dir = mkdtempSync(join(tmpdir(), "member-seed-cli-"));
  const manifest = join(dir, "manifest.json");
  writeFileSync(manifest, JSON.stringify({
    version: 1,
    batch: "synthetic-test",
    records: [],
    preparationRejected: [],
    preparationExcluded: []
  }));
  return { dir, manifest };
}

function runImport(args: string[]): string {
  try {
    execFileSync(process.execPath, ["scripts/import-members.mjs", ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return "";
  } catch (error) {
    const failure = error as { stderr?: string | Buffer };
    return String(failure.stderr || "");
  }
}

test("member seed requires manifest and explicit project", () => {
  const stderr = runImport([]);
  assert.match(stderr, /Usage: npm run seed:members/);
});

test("member seed refuses execute without exact confirmation before authentication", () => {
  const { dir, manifest } = privateManifestPath();
  try {
    const stderr = runImport([
      `--manifest=${manifest}`,
      "--project=coolock-ardlea-scouts",
      "--execute"
    ]);
    assert.match(stderr, /requires --execute --confirm=SEED-MEMBERS/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("member seed refuses an empty project before authentication", () => {
  const { dir, manifest } = privateManifestPath();
  try {
    const stderr = runImport([
      `--manifest=${manifest}`,
      "--project="
    ]);
    assert.match(stderr, /--project must be the exact Firebase project ID/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
