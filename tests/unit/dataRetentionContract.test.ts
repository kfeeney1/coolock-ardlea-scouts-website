import assert from "node:assert/strict";
import test from "node:test";

import {
  DATA_RETENTION_CONTRACT,
  DATA_SENSITIVITY,
  RETENTION_DISPOSITIONS,
  validateDataRetentionContract
} from "../../scripts/data-retention-contract.mjs";
import { FIRESTORE_ROOT_COLLECTIONS } from "../../scripts/firestore-collection-contract.mjs";

test("every canonical Firestore root collection has exactly one valid retention policy", () => {
  assert.deepEqual(validateDataRetentionContract(), []);
  assert.equal(DATA_RETENTION_CONTRACT.length, FIRESTORE_ROOT_COLLECTIONS.length);
  assert.equal(new Set(DATA_RETENTION_CONTRACT.map((entry) => entry.collection)).size, FIRESTORE_ROOT_COLLECTIONS.length);
});

test("Stage 19.4 introduces no automatic destructive retention policy", () => {
  const dispositions = new Set(DATA_RETENTION_CONTRACT.map((entry) => entry.disposition));
  assert.deepEqual(
    [...dispositions].sort(),
    [
      RETENTION_DISPOSITIONS.CONFIGURATION,
      RETENTION_DISPOSITIONS.MANUAL_REVIEW,
      RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE,
      RETENTION_DISPOSITIONS.SOURCE_PROJECTION
    ].sort()
  );
});

test("high-risk consent and medical data requires manual review before deletion", () => {
  const consent = DATA_RETENTION_CONTRACT.find((entry) => entry.collection === "consentApplications");
  const responses = DATA_RETENTION_CONTRACT.find((entry) => entry.collection === "eventConsentResponses");

  assert.equal(consent?.sensitivity, DATA_SENSITIVITY.SPECIAL_CATEGORY);
  assert.equal(consent?.disposition, RETENTION_DISPOSITIONS.MANUAL_REVIEW);
  assert.equal(responses?.disposition, RETENTION_DISPOSITIONS.MANUAL_REVIEW);
});

test("member lifecycle and programme history are not erased by section changes", () => {
  for (const collection of ["memberHistory", "memberAdventureSkillProgress"]) {
    const entry = DATA_RETENTION_CONTRACT.find((candidate) => candidate.collection === collection);
    assert.equal(entry?.disposition, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE);
  }
});

test("parent access remains an explicit offboarding concern", () => {
  const parentAccounts = DATA_RETENTION_CONTRACT.find((entry) => entry.collection === "parentAccounts");
  assert.equal(parentAccounts?.disposition, RETENTION_DISPOSITIONS.MANUAL_REVIEW);
  assert.equal(parentAccounts?.reviewTrigger, "parent-offboarding");
});

test("derived public and parent projections identify their canonical source", () => {
  const projections = DATA_RETENTION_CONTRACT.filter(
    (entry) => entry.disposition === RETENTION_DISPOSITIONS.SOURCE_PROJECTION
  );
  assert.ok(projections.length > 0);
  assert.ok(projections.every((entry) => typeof entry.sourceCollection === "string" && entry.sourceCollection.length > 0));
});
