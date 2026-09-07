import assert from "node:assert/strict";
import test from "node:test";

import { aggregatePlan, deterministicMemberId, planMemberImport, splitDisplayName } from "../../scripts/member-import-core.mjs";

const candidate = (overrides = {}) => ({
  displayName: "Synthetic Youth Member",
  dateOfBirth: "2016-05-04",
  section: "Cubs",
  importBatch: "synthetic-test-batch",
  sourceRef: "Cubs:row-2",
  ...overrides
});

test("splits a spreadsheet display name deterministically without inventing contact data", () => {
  assert.deepEqual(splitDisplayName("Synthetic Youth Member"), { firstName: "Synthetic Youth", lastName: "Member" });
});

test("plans a deterministic create for a new canonical member", () => {
  const plan = planMemberImport([candidate()]);
  assert.equal(plan.creates.length, 1);
  assert.equal(plan.creates[0].id, deterministicMemberId(candidate()));
  assert.equal(plan.creates[0].parentName, "");
  assert.equal(plan.creates[0].emailAddress, "");
  assert.equal(plan.creates[0].status, "active");
  assert.equal(plan.conflicts.length, 0);
});

test("treats an exact existing identity in the same section as a match, never an overwrite", () => {
  const plan = planMemberImport([candidate()], [{ id: "existing-1", displayName: "Synthetic Youth Member", dateOfBirth: "2016-05-04", section: "Cubs" }]);
  assert.equal(plan.creates.length, 0);
  assert.deepEqual(plan.matches, [{ sourceRef: "Cubs:row-2", existingId: "existing-1", section: "Cubs" }]);
});

test("blocks a same-person cross-section source duplicate for review", () => {
  const plan = planMemberImport([candidate(), candidate({ section: "Scouts", sourceRef: "Scouts:row-7" })]);
  assert.equal(plan.creates.length, 0);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].reason, "source-cross-section-duplicate");
});

test("blocks a source identity that conflicts with an existing section", () => {
  const plan = planMemberImport([candidate()], [{ id: "existing-1", displayName: "Synthetic Youth Member", dateOfBirth: "2016-05-04", section: "Scouts" }]);
  assert.equal(plan.creates.length, 0);
  assert.equal(plan.conflicts[0].reason, "existing-section-conflict");
});

test("rejects incomplete or noncanonical source rows", () => {
  const plan = planMemberImport([
    candidate({ displayName: "SingleName" }),
    candidate({ dateOfBirth: "04/05/2016", sourceRef: "Cubs:row-3" }),
    candidate({ section: "Ventures", sourceRef: "Cubs:row-4" })
  ]);
  assert.equal(plan.rejected.length, 3);
  assert.equal(plan.creates.length, 0);
});

test("aggregate output contains counts only", () => {
  const plan = planMemberImport([candidate(), candidate({ displayName: "Another Synthetic Member", dateOfBirth: "2016-06-05", sourceRef: "Cubs:row-3" })]);
  assert.deepEqual(aggregatePlan(plan), {
    proposedCreatesBySection: { Beavers: 0, Cubs: 2, Scouts: 0 },
    creates: 2,
    existingMatches: 0,
    conflicts: 0,
    rejected: 0
  });
});
