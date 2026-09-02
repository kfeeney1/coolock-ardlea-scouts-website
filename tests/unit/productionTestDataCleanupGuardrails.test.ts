import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const purgeScript = await readFile(new URL("../../scripts/purge-test-data.mjs", import.meta.url), "utf8");
const productionCredentialGuard = await readFile(
  new URL("../../scripts/check-workflow-production-credentials.mjs", import.meta.url),
  "utf8",
);

test("production TEST-data cleanup is dry-run by default and requires explicit execution gates", () => {
  assert.match(purgeScript, /process\.argv\.includes\("--execute"\)/);
  assert.match(purgeScript, /PROD_PURGE_CONFIRM_PROJECT/);
  assert.match(purgeScript, /PROD_PURGE_EXPECTED_FIRESTORE_COUNT/);
  assert.match(purgeScript, /PROD_PURGE_EXPECTED_AUTH_COUNT/);
  assert.match(purgeScript, /PROD_PURGE_EXPECTED_MANIFEST_SHA256/);
  assert.match(purgeScript, /PROD_PURGE_BACKUP_URI/);
  assert.match(purgeScript, /PROD_PURGE_BACKUP_VERIFIED_AT/);
  assert.match(purgeScript, /Dry run only\. No records or users were modified or deleted\./);
});

test("production workflows remain forbidden from invoking the TEST-data purge", () => {
  assert.match(productionCredentialGuard, /scripts\/purge-test-data\.mjs/);
});
