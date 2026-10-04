export function financeReceiptErrorMessage(error: unknown, operation: "check" | "upload" | "remove" | "open"): string {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code : "";
  const action = operation === "check" ? "Receipt check" : operation === "upload" ? "Receipt upload" : operation === "open" ? "Receipt opening" : "Receipt removal";
  const detail = code ? ` (${code})` : "";
  if (code === "storage/unauthorized" || code === "permission-denied") {
    return `${action} was denied. Your account does not have permission for this receipt operation.${detail}`;
  }
  if (code === "storage/unauthenticated") return `${action} requires sign-in. Sign in again and retry.${detail}`;
  if (code === "storage/object-not-found") {
    return `${action} could not find a stored receipt file. Retry the receipt check; the file may have been removed.${detail}`;
  }
  if (code === "storage/bucket-not-found" || code === "storage/no-default-bucket" || code === "storage/project-not-found") {
    return `${action} failed because receipt storage is not configured correctly. Contact an administrator.${detail}`;
  }
  if (code === "storage/retry-limit-exceeded" || code === "storage/receipt-check-timeout") {
    return `${action} timed out. Check your connection and retry.${detail}`;
  }
  if (code === "storage/canceled") return `${action} was cancelled. You can retry.${detail}`;
  return `${action} failed. Retry, and contact an administrator if the problem continues.${detail}`;
}
