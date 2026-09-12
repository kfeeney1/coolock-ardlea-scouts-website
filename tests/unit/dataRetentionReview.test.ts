import assert from "node:assert/strict";
import test from "node:test";

import {
  RETENTION_REVIEW_ACTIONS,
  buildRetentionDecisionRecord,
  retentionReviewItems,
  validateRetentionDecision
} from "../../scripts/data-retention-review.mjs";

test("member offboarding review is explicit and non-destructive by default", () => {
  const items = retentionReviewItems("member-left-or-offboarding");
  assert.ok(items.some((item) => item.collection === "members"));
  const member = items.find((item) => item.collection === "members");
  assert.ok(member?.allowedActions.includes(RETENTION_REVIEW_ACTIONS.RETAIN));
  assert.ok(member?.allowedActions.includes(RETENTION_REVIEW_ACTIONS.RESTRICT));
  assert.ok(member?.allowedActions.includes(RETENTION_REVIEW_ACTIONS.ANONYMISE));
  assert.ok(member?.allowedActions.includes(RETENTION_REVIEW_ACTIONS.DELETE));
});

test("destructive actions require an approved organisational policy reference", () => {
  const errors = validateRetentionDecision({
    collection: "members",
    recordId: "member-1",
    action: RETENTION_REVIEW_ACTIONS.DELETE,
    reviewedBy: "group-admin",
    rationale: "Member has left"
  });
  assert.ok(errors.some((error) => /approvedPolicyReference/.test(error)));
});

test("auditable retention decision records capture reviewer, rationale and timestamp", () => {
  const record = buildRetentionDecisionRecord({
    collection: "members",
    recordId: "member-1",
    action: RETENTION_REVIEW_ACTIONS.RESTRICT,
    reviewedBy: "group-admin",
    rationale: "Restrict from ongoing operational use pending retention review"
  }, () => "2026-09-12T18:50:00.000Z");

  assert.deepEqual(record, {
    collection: "members",
    recordId: "member-1",
    action: "restrict",
    reviewedBy: "group-admin",
    rationale: "Restrict from ongoing operational use pending retention review",
    approvedPolicyReference: "",
    reviewedAt: "2026-09-12T18:50:00.000Z"
  });
});

test("no automatic destructive action is inferred from a lifecycle trigger", () => {
  for (const trigger of ["member-left-or-offboarding", "parent-offboarding", "leader-offboarding", "consent-purpose-ended"]) {
    const items = retentionReviewItems(trigger);
    for (const item of items) {
      assert.equal("automaticAction" in item, false);
    }
  }
});
