import assert from "node:assert/strict";
import { test } from "node:test";
import { financeReceiptErrorMessage } from "../../src/services/financeReceiptErrors.ts";

test("receipt access failures retain permission and authentication codes", () => {
  for (const code of ["storage/unauthorized", "permission-denied"]) {
    const message = financeReceiptErrorMessage({ code }, "check");
    assert.match(message, /denied/);
    assert.match(message, /Code: (?:UNAUTHORIZED|PERMISSION_DENIED)/);
    assert.doesNotMatch(message, /unavailable/);
  }
  assert.match(financeReceiptErrorMessage({ code: "storage/unauthenticated" }, "upload"), /requires sign-in/);
});

test("missing receipt files, configuration and timeouts are distinct", () => {
  assert.match(financeReceiptErrorMessage({ code: "storage/object-not-found" }, "check"), /could not find the stored receipt/);
  assert.match(financeReceiptErrorMessage({ code: "storage/bucket-not-found" }, "check"), /not configured correctly/);
  assert.match(financeReceiptErrorMessage({ code: "storage/receipt-check-timeout" }, "check"), /timed out/);
});

test("unknown errors retain codes without exposing raw payloads", () => {
  const message = financeReceiptErrorMessage({ code: "storage/unknown", message: "secret payload" }, "upload");
  assert.match(message, /Receipt upload failed/);
  assert.match(message, /Code: UNKNOWN/);
  assert.doesNotMatch(message, /secret payload|unavailable/);
  assert.match(financeReceiptErrorMessage(null, "remove"), /Receipt removal failed.*Code: UNKNOWN_FAILURE/);
});


test("receipt diagnostics present operation, service, normalized code and one recovery action", () => {
  const message = financeReceiptErrorMessage({ code: "storage/object-not-found" }, "open", { transactionId: "tx123", section: "Scouts" });
  assert.match(message, /Receipt opening could not find the stored receipt/);
  assert.match(message, /Operation: Receipt open/);
  assert.match(message, /Service: Firebase Storage/);
  assert.match(message, /Code: OBJECT_NOT_FOUND/);
  assert.equal((message.match(/Action:/g) ?? []).length, 1);
  assert.equal((message.match(/Reference:/g) ?? []).length, 1);
  assert.doesNotMatch(message, /Retry.*Try again|contact an administrator.*contact an administrator/i);
});
