import assert from "node:assert/strict";
import test from "node:test";
import { gcloudExecutable } from "../../scripts/member-import-auth.mjs";

test("selects gcloud.cmd on Windows", () => {
  assert.equal(gcloudExecutable("win32"), "gcloud.cmd");
});

test("selects gcloud on non-Windows platforms", () => {
  assert.equal(gcloudExecutable("linux"), "gcloud");
  assert.equal(gcloudExecutable("darwin"), "gcloud");
});
