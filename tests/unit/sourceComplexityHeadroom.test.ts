import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const guard = readFileSync(resolve("scripts/report-source-complexity.mjs"), "utf8");

function checkFixture(bytes: number, ceiling = 20000, historical = false, missing = false) {
  const root = mkdtempSync(join(tmpdir(), "source-headroom-"));
  try {
    for (const path of ["src/pages", "src/components", "src/services", "e2e", "scripts"]) mkdirSync(join(root, path), { recursive: true });
    const path = "src/pages/SubsManagement.tsx";
    // Non-ASCII source demonstrates enforcement of UTF-8 bytes, not characters.
    if (!missing) writeFileSync(join(root, path), "é".repeat(Math.floor(bytes / 2)) + (bytes % 2 ? "x" : ""));
    writeFileSync(join(root, "scripts/source-complexity-baseline.json"), JSON.stringify({
      thresholdBytes: 25000,
      growthAllowanceBytes: 2048,
      knownLargeFiles: historical ? { [path]: 30000 } : {},
      headroomCeilings: { [path]: ceiling },
    }));
    writeFileSync(join(root, "guard.mjs"), guard);
    return spawnSync(process.execPath, [join(root, "guard.mjs"), "--check"], { cwd: root, encoding: "utf8" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("headroom guard accepts the boundary and rejects a UTF-8 byte of regrowth below the global ceiling", () => {
  assert.equal(checkFixture(20000).status, 0);
  const result = checkFixture(20001);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /20001 bytes exceeds preserved headroom ceiling 20000/);
});

test("headroom guard cannot provide an oversized exemption or coexist with one", () => {
  assert.match(checkFixture(100, 30000).stderr, /at or below 25000/);
  assert.match(checkFixture(100, 20000, true).stderr, /cannot coexist with a historical oversized allowance/);
});

test("headroom guard rejects a stale entry after deletion or rename", () => {
  const result = checkFixture(100, 20000, false, true);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /headroom entry no longer resolves/);
});
