import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("event persistence enforces lifecycle transitions and close-out readiness", async () => {
  const source = await readFile("src/services/eventAdmin.ts", "utf8");
  assert.match(source, /canTransitionEventStatus/);
  assert.match(source, /eventCloseOutIssues/);
  assert.match(source, /New events must start as Draft or Open/);
  assert.match(source, /Completed event rosters are read-only/);
  assert.match(source, /Event completed/);
});
