import assert from "node:assert/strict";
import { test } from "node:test";
import { applicationErrorMessage, configureErrorEnvironment, errorCategory, reportApplicationError, ServiceFailure, UserInputError } from "../../src/services/applicationErrors.ts";
import { financeReceiptErrorMessage } from "../../src/services/financeReceiptErrors.ts";
import { requestBackend } from "../../src/services/backendRequest.ts";

test("Firestore denial retains original cause/code and reference without private payloads", (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  configureErrorEnvironment("production");
  const cause = Object.assign(new Error("patient PRIVATE_MEDICAL password=PRIVATE_PASSWORD bearer PRIVATE_TOKEN"), {
    code: "firestore/permission-denied", customData: { consent: "PRIVATE_CONSENT" },
    stack: "Error: PRIVATE_MEDICAL\n at PRIVATE_PERSON (https://private.example/person/Member.tsx:42:7)\nPRIVATE_TOKEN",
  });
  const report = reportApplicationError(cause, { area: "Members", operation: "Save member", userMessage: "Member save failed.", identifiers: { recordId: "record123", section: "Scouts" } });
  assert.equal(report.cause, cause);
  assert.equal(report.diagnostic.code, "firestore/permission-denied");
  assert.equal(report.diagnostic.category, "permission");
  assert.equal(report.diagnostic.environment, "production");
  assert.deepEqual(report.diagnostic.stack, ["Member.tsx:42:7"]);
  assert.match(report.userMessage, /Member save failed.*permission.*Reference: ERR-[A-F0-9]{12}/);
  assert.ok(report.userMessage.includes(report.diagnostic.reference));
  assert.doesNotMatch(JSON.stringify([logs, report.userMessage]), /PRIVATE_|private.example|customData/);
  assert.equal(reportApplicationError(cause, { area: "Members", operation: "Save member" }), report);
  assert.equal(logs.length, 1);
});

test("Storage receipt upload fails explicitly and preserves its code and transaction context", (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  const cause = Object.assign(new Error("PRIVATE_FILE"), { code: "storage/unauthorized" });
  const message = financeReceiptErrorMessage(cause, "upload", { transactionId: "transaction123", section: "Cubs" });
  assert.match(message, /Receipt upload.*denied.*Reference: ERR-/);
  assert.doesNotMatch(message, /complete|success|PRIVATE_FILE/);
  const diagnostic = logs[0][1] as { code: string; identifiers: { transactionId: string } };
  assert.equal(diagnostic.code, "storage/unauthorized");
  assert.equal(diagnostic.identifiers.transactionId, "transaction123");
});

test("backend status is retained without reading a private response body", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const [status, category] of [[403, "permission"], [503, "unavailable"], [409, "conflict"]] as const) {
    let failure: unknown;
    try { await requestBackend("https://service.invalid/action", {}, async () => new Response("PRIVATE_RESPONSE", { status })); }
    catch (error) { failure = error; }
    assert.ok(failure instanceof ServiceFailure);
    const report = reportApplicationError(failure, { area: "Backend", operation: "Send notification" });
    assert.equal(report.diagnostic.status, status);
    assert.equal(report.diagnostic.category, category);
    assert.doesNotMatch(JSON.stringify(report.diagnostic) + report.userMessage, /PRIVATE_RESPONSE/);
  }
});

test("network rejection is distinct from permissions and retains original exception", async (t) => {
  t.mock.method(console, "error", () => {});
  const cause = Object.assign(new TypeError("Failed to fetch"), { details: "PRIVATE_NETWORK_PAYLOAD" });
  let failure: unknown;
  try { await requestBackend("https://service.invalid/action", {}, async () => { throw cause; }); }
  catch (error) { failure = error; }
  assert.ok(failure instanceof ServiceFailure);
  assert.equal(failure.cause, cause);
  const report = reportApplicationError(failure, { area: "Backend", operation: "Send notification" });
  assert.equal(report.diagnostic.category, "network");
  assert.match(report.userMessage, /connection/);
  assert.doesNotMatch(JSON.stringify(report.diagnostic), /PRIVATE_NETWORK_PAYLOAD/);
  assert.equal(errorCategory(cause), "unexpected");
});

test("Functions and Auth codes retain meaningful categories", (t) => {
  t.mock.method(console, "error", () => {});
  for (const [code, category] of [["functions/unavailable", "unavailable"], ["functions/unauthenticated", "authentication"], ["auth/network-request-failed", "network"], ["storage/object-not-found", "not-found"]] as const) {
    const report = reportApplicationError({ code }, { area: "Application", operation: "Request" });
    assert.equal(report.diagnostic.code, code);
    assert.equal(report.diagnostic.category, category);
  }
});

test("unknown and nested errors are safe, retain causes, and never guessed as permissions", (t) => {
  t.mock.method(console, "error", () => {});
  const original = Object.assign(new Error("PRIVATE_MEDICATION"), { code: "storage/unauthorized" });
  const error = new Error("PRIVATE_PASSWORD", { cause: original });
  const report = reportApplicationError(error, { area: "Medical", operation: "Save information", identifiers: { recordId: "person@example.com" } });
  assert.equal(report.cause, error);
  assert.equal(report.diagnostic.category, "unexpected");
  assert.equal(report.diagnostic.causes[0].code, "storage/unauthorized");
  assert.deepEqual(report.diagnostic.identifiers, {});
  assert.doesNotMatch(JSON.stringify(report.diagnostic) + report.userMessage, /PRIVATE_|example.com/);
  assert.match(applicationErrorMessage(null, "Save failed.", "Medical"), /Save failed.*Reference: ERR-/);
});

test("successful backend requests create no error diagnostics", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  assert.deepEqual(await requestBackend("https://service.invalid/action", {}, async () => Response.json({ ok: true })), { ok: true });
  assert.equal(await requestBackend("https://service.invalid/action", {}, async () => new Response(null, { status: 204 })), undefined);
  assert.equal(logs.length, 0);
});

test("reviewed validation messages survive while payload errors do not", (t) => {
  t.mock.method(console, "error", () => {});
  const report = reportApplicationError(new UserInputError("Choose an image up to 10 MB."), { area: "Uploads", operation: "Upload photo" });
  assert.equal(report.diagnostic.category, "validation");
  assert.match(report.userMessage, /Choose an image up to 10 MB/);
});

test("a backend reference joins client and server diagnostics without accepting arbitrary header text", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const reference of ["ERR-ABC123ABC123", "PRIVATE_TOKEN"]) {
    let failure: unknown;
    try { await requestBackend("https://service.invalid/action", {}, async () => new Response("PRIVATE_RESPONSE", { status: 503, headers: { "X-Error-Reference": reference } })); }
    catch (error) { failure = error; }
    const report = reportApplicationError(failure, { area: "Backend", operation: "Request notification" });
    if (reference.startsWith("ERR-")) assert.equal(report.diagnostic.reference, reference);
    else assert.doesNotMatch(report.userMessage + JSON.stringify(report.diagnostic), /PRIVATE_TOKEN/);
  }
});

test("unknown error-code payloads and accidental serialization cannot leak the original exception", (t) => {
  t.mock.method(console, "error", () => {});
  const report = reportApplicationError({ code: "storage/private-secret", message: "PRIVATE_MEDICAL", secret: "PRIVATE_TOKEN" }, { area: "Uploads", operation: "Upload file" });
  assert.equal(report.diagnostic.code, undefined);
  assert.doesNotMatch(JSON.stringify(report), /private-secret|PRIVATE_/);
  assert.equal((report.cause as { secret: string }).secret, "PRIVATE_TOKEN");
});

test("legacy Firestore UI classification never guesses permissions or quota from arbitrary text", async () => {
  const { classifyFirestoreFailure } = await import("../../src/services/firestoreErrors.ts");
  assert.equal(classifyFirestoreFailure(new Error("missing or insufficient permissions")), "unknown");
  assert.equal(classifyFirestoreFailure(new Error("quota mentioned in a unrelated exception")), "unknown");
  assert.equal(classifyFirestoreFailure({ code: "permission-denied" }), "permission");
  assert.equal(classifyFirestoreFailure({ code: "firestore/resource-exhausted" }), "quota");
});

test("unclassified exceptions at fetch boundary remain unexpected with their original cause", async (t) => {
  t.mock.method(console, "error", () => {});
  const cause = new Error("PRIVATE_CONFIGURATION_EXCEPTION");
  let failure: unknown;
  try { await requestBackend("https://service.invalid/action", {}, async () => { throw cause; }); }
  catch (error) { failure = error; }
  assert.ok(failure instanceof ServiceFailure);
  assert.equal(failure.cause, cause);
  assert.equal(errorCategory(failure), "unexpected");
  assert.doesNotMatch(JSON.stringify(reportApplicationError(failure, { area: "Backend", operation: "Request" })), /PRIVATE_/);
});
