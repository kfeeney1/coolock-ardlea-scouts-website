import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rules = readFileSync(new URL("../../storage.rules", import.meta.url), "utf8");

test("only the explicit public audience is anonymous-readable", () => {
  assert.match(rules, /return audience == "public"/);
  assert.match(rules, /audience == "authenticated" && \(isActiveLeader\(\) \|\| isApprovedParent\(\)\)/);
});
