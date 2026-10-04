import assert from "node:assert/strict";
import { test } from "node:test";
import { backendFailureDiagnostic } from "../src/backendDiagnostics.js";
import { privacySafeDiagnostic } from "../src/entry.js";

test("backend references retain upstream status and exclude private exception bodies", () => {
  const error = Object.assign(new Error("Resend returned 503: PRIVATE_EMAIL PRIVATE_MEDICAL PRIVATE_TOKEN"), { cause: new Error("PRIVATE_PASSWORD") });
  const report = backendFailureDiagnostic(error, "/leader-communication", "production");
  assert.match(report.reference, /^ERR-[A-F0-9]{12}$/);
  assert.equal(report.status, 503);
  assert.equal(report.operation, "/leader-communication");
  assert.equal(report.environment, "production");
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_/);
  const logged = privacySafeDiagnostic(["Backend failure", report]);
  assert.equal(logged.detail.reference, report.reference);
  assert.equal(logged.detail.status, 503);
  assert.doesNotMatch(JSON.stringify(logged), /PRIVATE_/);
});

test("untrusted backend context cannot put payloads in diagnostics", () => {
  const report = backendFailureDiagnostic({ message: "PRIVATE", code: "PRIVATE_TOKEN", status: 123456 }, "/member/person@example.com", "PRIVATE_ENV");
  assert.equal(report.operation, "backend request");
  assert.equal(report.environment, "unknown");
  assert.equal(report.status, undefined);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE|example.com/);
});
