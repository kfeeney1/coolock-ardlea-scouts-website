import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const canonicalPassword = "password1";

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("Playwright uses the canonical development password only in emulator-backed E2E", () => {
  const playwrightWorkflow = read(".github/workflows/playwright-e2e.yml");

  assert.match(playwrightWorkflow, new RegExp(`E2E_TEST_USER_PASSWORD: ${canonicalPassword}`));
  assert.doesNotMatch(playwrightWorkflow, /secrets\.E2E_TEST_USER_PASSWORD/);
});
