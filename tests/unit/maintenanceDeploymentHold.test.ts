import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Maintenance predeploy blocks explicit deployments for either Firebase configuration", () => {
  for (const file of ["firebase.json", "firebase.test.json"]) {
    const config = JSON.parse(readFileSync(file, "utf8"));
    const maintenance = config.functions.find((item) => item.codebase === "maintenance");
    assert.deepEqual(maintenance.predeploy, ["node scripts/block-maintenance-deploy.mjs"]);
    const result = spawnSync(process.execPath, ["scripts/block-maintenance-deploy.mjs"], {encoding: "utf8"});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /zero-spend hosting architecture/);
  }
});
