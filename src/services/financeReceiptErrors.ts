import { reportApplicationError, diagnosticErrorCode } from "./applicationErrors.ts";
function receiptDescription(error: unknown, operation: "check" | "upload" | "remove" | "open"): string {
  const code = diagnosticErrorCode(error);
  const action = operation === "check" ? "Receipt check" : operation === "upload" ? "Receipt upload" : operation === "open" ? "Receipt opening" : "Receipt removal";
  if (code === "storage/unauthorized" || code === "permission-denied") return `${action} was denied.`;
  if (code === "storage/unauthenticated") return `${action} requires sign-in.`;
  if (code === "storage/object-not-found") return `${action} could not find the stored receipt.`;
  if (code === "storage/bucket-not-found" || code === "storage/no-default-bucket" || code === "storage/project-not-found") return `${action} failed because receipt storage is not configured correctly.`;
  if (code === "storage/retry-limit-exceeded" || code === "storage/receipt-check-timeout" || code === "storage/download-timeout") return `${action} timed out.`;
  if (code === "storage/canceled") return `${action} was cancelled.`;
  return `${action} failed.`;
}

export function financeReceiptErrorMessage(error: unknown, operation: "check" | "upload" | "remove" | "open", identifiers?: { transactionId?: string; section?: string }): string {
  const description = receiptDescription({ code: diagnosticErrorCode(error) }, operation);
  return reportApplicationError(error, { area: "Finance receipts", operation: `Receipt ${operation}`, userMessage: description, identifiers }).userMessage;
}
