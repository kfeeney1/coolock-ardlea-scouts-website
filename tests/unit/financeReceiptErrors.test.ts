import assert from "node:assert/strict";
import { test } from "node:test";
import { financeReceiptErrorMessage } from "../../src/services/financeReceiptErrors.ts";

test("receipt access failures retain permission and authentication codes", () => {
  for (const code of ["storage/unauthorized", "permission-denied"]) {
    const message = financeReceiptErrorMessage({ code }, "check");
    assert.match(message, /denied/);
    assert.ok(message.includes(code));
    assert.doesNotMatch(message, /unavailable/);
  }
  assert.match(financeReceiptErrorMessage({ code: "storage/unauthenticated" }, "upload"), /requires sign-in/);
});

test("missing receipt files, configuration and timeouts are distinct", () => {
  assert.match(financeReceiptErrorMessage({ code: "storage/object-not-found" }, "check"), /could not find a stored receipt file/);
  assert.match(financeReceiptErrorMessage({ code: "storage/bucket-not-found" }, "check"), /not configured correctly/);
  assert.match(financeReceiptErrorMessage({ code: "storage/receipt-check-timeout" }, "check"), /timed out/);
});

test("unknown errors retain codes without exposing raw payloads", () => {
  const message = financeReceiptErrorMessage({ code: "storage/unknown", message: "secret payload" }, "upload");
  assert.match(message, /Receipt upload failed/);
  assert.match(message, /storage\/unknown/);
  assert.doesNotMatch(message, /secret payload|unavailable/);
  assert.match(financeReceiptErrorMessage(null, "remove"), /Receipt removal failed/);
});
