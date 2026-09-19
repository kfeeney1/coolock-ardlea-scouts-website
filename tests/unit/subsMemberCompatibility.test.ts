import assert from "node:assert/strict";
import test from "node:test";
import { mapSubsMember } from "../../src/services/subsMemberCompatibility.ts";

test("finance member compatibility accepts active production-era records", () => {
  const member = mapSubsMember("legacy", { displayName: "Alex Scout", section: "Cubs", status: "active" });
  assert.ok(member);
  assert.equal(member.firstName, "Alex");
  assert.equal(member.lastName, "Scout");
  assert.equal(member.dateOfBirth, "");
});

test("finance member compatibility excludes malformed and unknown-lifecycle records", () => {
  assert.equal(mapSubsMember("missing-status", { displayName: "Alex Scout", section: "Cubs" }), null);
  assert.equal(mapSubsMember("missing-section", { displayName: "Alex Scout", status: "active" }), null);
});
