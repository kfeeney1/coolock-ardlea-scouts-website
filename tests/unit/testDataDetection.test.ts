import assert from "node:assert/strict";
import test from "node:test";
import { classifyTestDocument, isTestDocument } from "../../scripts/test-data-detection.mjs";

type FakeDoc = { id: string; data: () => Record<string, unknown> };

function doc(id: string, data: Record<string, unknown> = {}): FakeDoc {
  return { id, data: () => data };
}

test("canonical TEST documents are detected by stable identifiers and seed markers", () => {
  const candidate = doc("TEST_member_beaver_01", {
    testData: true,
    testSeed: "comprehensive-population-v3",
    createdBySeed: "TEST_SEED",
  });

  assert.equal(isTestDocument(candidate), true);
  assert.deepEqual(classifyTestDocument(candidate), ["marked-test-data", "test-reference:document-id"]);
});

test("legacy TEST references remain detectable without broad name or email matching", () => {
  assert.equal(isTestDocument(doc("response-1", { eventId: "TEST_flow_event_beavers_open" })), true);
  assert.equal(isTestDocument(doc("parent-1", { memberIds: ["TEST_member_beaver_01"] })), true);
});

test("ordinary production records are never classified from names or emails alone", () => {
  const realRecord = doc("member-123", {
    displayName: "Test Person",
    email: "test@example.com",
    memberIds: ["member-456"],
  });

  assert.equal(isTestDocument(realRecord), false);
  assert.deepEqual(classifyTestDocument(realRecord), []);
});
