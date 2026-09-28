import assert from "node:assert/strict";
import test from "node:test";

import { buildAiHandoverPrompt, SYSTEM_INFORMATION } from "../../src/operations/systemInformation.ts";
import { formatSiteDate } from "../../src/services/siteDateFormat.ts";

test("system information review date uses the canonical site presentation", () => {
  assert.equal(formatSiteDate(SYSTEM_INFORMATION.lastReviewed), "23-09-2026");
  const prompt = buildAiHandoverPrompt();
  assert.match(prompt, /Documentation last reviewed: 23-09-2026/);
  assert.doesNotMatch(prompt, /Documentation last reviewed: 2026-09-23/);
});
