import {
  DATA_RETENTION_CONTRACT,
  RETENTION_DISPOSITIONS
} from "./data-retention-contract.mjs";

export const RETENTION_REVIEW_ACTIONS = Object.freeze({
  RETAIN: "retain",
  RESTRICT: "restrict",
  ANONYMISE: "anonymise",
  DELETE: "delete",
  REBUILD_PROJECTION: "rebuild-projection",
  NO_ACTION: "no-action"
});

const destructiveActions = new Set([
  RETENTION_REVIEW_ACTIONS.ANONYMISE,
  RETENTION_REVIEW_ACTIONS.DELETE
]);

export function retentionReviewItems(reviewTrigger, contract = DATA_RETENTION_CONTRACT) {
  const trigger = String(reviewTrigger || "").trim();
  if (!trigger) return [];
  return contract
    .filter((entry) => entry.reviewTrigger === trigger)
    .map((entry) => ({
      collection: entry.collection,
      domain: entry.domain,
      sensitivity: entry.sensitivity,
      disposition: entry.disposition,
      sourceCollection: entry.sourceCollection,
      rationale: entry.rationale,
      allowedActions: entry.disposition === RETENTION_DISPOSITIONS.SOURCE_PROJECTION
        ? [RETENTION_REVIEW_ACTIONS.REBUILD_PROJECTION, RETENTION_REVIEW_ACTIONS.NO_ACTION]
        : entry.disposition === RETENTION_DISPOSITIONS.MANUAL_REVIEW
          ? [
              RETENTION_REVIEW_ACTIONS.RETAIN,
              RETENTION_REVIEW_ACTIONS.RESTRICT,
              RETENTION_REVIEW_ACTIONS.ANONYMISE,
              RETENTION_REVIEW_ACTIONS.DELETE
            ]
          : [RETENTION_REVIEW_ACTIONS.RETAIN, RETENTION_REVIEW_ACTIONS.NO_ACTION]
    }));
}

export function validateRetentionDecision(decision) {
  const errors = [];
  if (!decision || typeof decision !== "object") return ["Retention decision must be an object."];

  const policy = DATA_RETENTION_CONTRACT.find((entry) => entry.collection === decision.collection);
  if (!policy) errors.push("Retention decision must reference a known collection.");

  const action = String(decision.action || "").trim();
  const reviewer = String(decision.reviewedBy || "").trim();
  const rationale = String(decision.rationale || "").trim();
  const approvedPolicyReference = String(decision.approvedPolicyReference || "").trim();

  if (!Object.values(RETENTION_REVIEW_ACTIONS).includes(action)) errors.push("Retention decision has an invalid action.");
  if (!reviewer) errors.push("Retention decision requires reviewedBy for auditability.");
  if (!rationale) errors.push("Retention decision requires a rationale.");

  if (policy) {
    const reviewItem = retentionReviewItems(policy.reviewTrigger).find((item) => item.collection === policy.collection);
    if (reviewItem && !reviewItem.allowedActions.includes(action)) {
      errors.push(`Action ${action} is not permitted by the retention contract for ${policy.collection}.`);
    }
  }

  if (destructiveActions.has(action) && !approvedPolicyReference) {
    errors.push("Destructive retention actions require an approvedPolicyReference; development must not invent a retention decision.");
  }

  return errors;
}

export function buildRetentionDecisionRecord(decision, now = () => new Date().toISOString()) {
  const errors = validateRetentionDecision(decision);
  if (errors.length) throw new Error(errors.join(" "));
  return Object.freeze({
    collection: decision.collection,
    recordId: String(decision.recordId || "").trim(),
    action: decision.action,
    reviewedBy: String(decision.reviewedBy).trim(),
    rationale: String(decision.rationale).trim(),
    approvedPolicyReference: String(decision.approvedPolicyReference || "").trim(),
    reviewedAt: now()
  });
}

export function assertNoAutomaticDestructiveRetention(contract = DATA_RETENTION_CONTRACT) {
  const unsafe = contract.filter((entry) => !Object.values(RETENTION_DISPOSITIONS).includes(entry.disposition));
  if (unsafe.length) throw new Error(`Unknown retention disposition(s): ${unsafe.map((entry) => entry.collection).join(", ")}`);
  return true;
}
