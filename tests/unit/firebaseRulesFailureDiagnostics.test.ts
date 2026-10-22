import assert from "node:assert/strict";
import test from "node:test";
import { firebaseRulesHttpStatuses } from "../../scripts/firebase-rules-failure-diagnostics.mjs";

test("exposes the hidden release PATCH status before the fallback conflict", () => {
  const endpoint = "https://firebaserules.googleapis.com/v1/projects/coolock-ardlea-scouts-test/releases";
  assert.deepEqual(firebaseRulesHttpStatuses([
    `[debug] <<< [apiv2][status] PATCH ${endpoint}/cloud.firestore 403`,
    `[debug] <<< [apiv2][status] POST ${endpoint} 409`,
  ].join("\n")), ["Firebase Rules API PATCH HTTP 403", "Firebase Rules API POST HTTP 409"]);
});

test("never emits credentials, bodies, query strings or foreign endpoint metadata", () => {
  const endpoint = "https://firebaserules.googleapis.com/v1/projects/coolock-ardlea-scouts-test/releases";
  const secret = "sensitive-token";
  assert.deepEqual(firebaseRulesHttpStatuses([
    `[apiv2][body] PATCH ${endpoint}/cloud.firestore ${secret}`,
    `[apiv2][header] PATCH ${endpoint}/cloud.firestore Authorization: Bearer ${secret}`,
    `[apiv2][status] PATCH ${endpoint}/cloud.firestore?token=${secret} 403`,
    `[apiv2][status] PATCH ${endpoint}/cloud.firestore 403 ${secret}`,
    `[apiv2][status] PATCH ${endpoint.replace(".googleapis.com", ".googleapis.com.evil")}/cloud.firestore 403`,
    `[apiv2][status] PATCH ${endpoint.replace("-test", "")}/cloud.firestore 403`,
    `[apiv2][status] PATCH ${endpoint}/cloud.firestore 500`,
  ].join("\n")), ["Firebase Rules API PATCH HTTP 500"]);
});

test("bounds diagnostics and tolerates missing status records", () => {
  assert.deepEqual(firebaseRulesHttpStatuses("unstructured failure"), []);
  const line = "[apiv2][status] POST https://firebaserules.googleapis.com/v1/projects/coolock-ardlea-scouts-test:test 503";
  assert.equal(firebaseRulesHttpStatuses(Array(30).fill(line).join("\n")).length, 20);
});
