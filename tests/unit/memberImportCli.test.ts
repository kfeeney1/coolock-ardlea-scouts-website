import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function privateManifestPath(): { dir: string; manifest: string } {
  const dir = mkdtempSync(join(tmpdir(), "member-import-cli-"));
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

function runImport(manifest: string, args: string[] = [], env: NodeJS.ProcessEnv = {}): string {
  try {
    execFileSync(process.execPath, ["scripts/import-members.mjs", `--manifest=${manifest}`, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FIREBASE_SERVICE_ACCOUNT_JSON: "",
        PROD_MEMBER_IMPORT_CONFIRM_PROJECT: "",
        ...env
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return "";
  } catch (error) {
    const failure = error as { stderr?: string | Buffer };
    return String(failure.stderr || "");
  }
}

test("ADC dry-run requires an explicit project confirmation", () => {
  const { dir, manifest } = privateManifestPath();
  try {
    const stderr = runImport(manifest);
    assert.match(stderr, /ADC dry-run requires PROD_MEMBER_IMPORT_CONFIRM_PROJECT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ADC credentials can never be used for execute mode", () => {
  const { dir, manifest } = privateManifestPath();
  try {
    const stderr = runImport(manifest, ["--execute"], {
      PROD_MEMBER_IMPORT_CONFIRM_PROJECT: "coolock-ardlea-scouts"
    });
    assert.match(stderr, /Production mutation still requires FIREBASE_SERVICE_ACCOUNT_JSON; ADC is dry-run only/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
