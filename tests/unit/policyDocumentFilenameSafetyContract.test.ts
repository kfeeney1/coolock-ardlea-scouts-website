import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("callers cannot use raw filenames or titles as arbitrary Storage paths", () => {
  assert.match(service, /function safeSegment/);
  assert.match(service, /replace\(\/\[\^a-z0-9\._-\]\+\/g, "-"\)/);
  assert.match(service, /const fileName = safeSegment\(input\.file\.name/);
});
