import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const canonicalPassword = "password1";

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("live seed and Playwright use the canonical development password", () => {
  const liveSeedWorkflow = read(".github/workflows/firebase-seed-test-data.yml");
  const playwrightWorkflow = read(".github/workflows/playwright-e2e.yml");

  assert.match(liveSeedWorkflow, new RegExp(`E2E_TEST_USER_PASSWORD: ${canonicalPassword}`));
  assert.match(playwrightWorkflow, new RegExp(`E2E_TEST_USER_PASSWORD: ${canonicalPassword}`));
  assert.doesNotMatch(liveSeedWorkflow, /secrets\.E2E_TEST_USER_PASSWORD/);
  assert.doesNotMatch(playwrightWorkflow, /secrets\.E2E_TEST_USER_PASSWORD/);
});
