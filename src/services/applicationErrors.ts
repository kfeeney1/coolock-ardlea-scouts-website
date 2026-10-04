/** Central error boundary. Never serialize the original exception or arbitrary context. */
export type ErrorCategory = "validation" | "permission" | "authentication" | "network" | "unavailable" | "not-found" | "conflict" | "storage" | "unexpected";
export type ErrorContext = { area: string; operation: string; userMessage?: string; identifiers?: { recordId?: string; transactionId?: string; eventId?: string; section?: string } };
export type ErrorDiagnostic = { reference: string; timestamp: string; environment: string; area: string; operation: string; category: ErrorCategory; code?: string; status?: number; type: string; message: string; stack?: string[]; causes: { type: string; code?: string; status?: number }[]; identifiers: Record<string, string> };
export type ReportedError = { userMessage: string; diagnostic: ErrorDiagnostic; cause: unknown };
let environment = "unknown";
const reports = new WeakMap<object, Map<string, ReportedError>>();
export function configureErrorEnvironment(value: string): void {
  environment = ["production", "test", "local", "development"].includes(value) ? value : "unknown";
}
/** Only static, explicitly reviewed application text belongs in these classes. */
export class UserFacingError extends Error {
  readonly code = "app/operation-rejected";
}
export class UserInputError extends Error {
  readonly code = "app/validation";
}
export class ServiceFailure extends Error {
  readonly code: string;
  readonly status?: number;
  readonly backendReference?: string;
  constructor(message: string, code: string, options?: { cause?: unknown; status?: number; backendReference?: string }) {
    super(message, { cause: options?.cause });
    this.name = "ServiceFailure";
    this.code = code;
    this.status = options?.status;
    this.backendReference = options?.backendReference;
  }
}
function field(value: unknown, key: string): unknown {
  try { return value && typeof value === "object" ? Reflect.get(value, key) : undefined; } catch { return undefined; }
}
export function diagnosticErrorCode(error: unknown): string | undefined {
  const value = field(error, "code");
  // Codes are a vocabulary, never an arbitrary message/payload.
  if (typeof value !== "string" || !/^(?:(?:auth|firestore|storage|functions|app|backend)\/)?[a-z][a-z-]{1,60}$/.test(value)) return undefined;
  const knownCodes = new Set([
    "validation", "operation-rejected", "request-failed", "network-error", "invalid-response", "service-not-configured",
    "permission-denied", "unauthorized", "unauthenticated", "invalid-credential", "wrong-password", "user-not-found",
    "user-token-expired", "invalid-user-token", "requires-recent-login", "user-disabled", "network-request-failed",
    "offline", "unavailable", "deadline-exceeded", "retry-limit-exceeded", "receipt-check-timeout", "upload-timeout",
    "internal", "resource-exhausted", "not-found", "object-not-found", "already-exists", "aborted", "unknown",
    "invalid-argument", "weak-password", "invalid-email", "email-already-in-use", "too-many-requests",
    "failed-precondition", "out-of-range", "unimplemented", "data-loss", "cancelled", "canceled",
    "bucket-not-found", "project-not-found", "quota-exceeded", "no-default-bucket", "invalid-url", "invalid-checksum",
    "server-file-wrong-size", "cannot-slice-blob", "app-deleted", "invalid-format", "invalid-event-name",
    "operation-not-allowed", "credential-already-in-use", "account-exists-with-different-credential", "invalid-password",
  ]);
  return knownCodes.has(value.split("/").at(-1)!) ? value : undefined;
}
function statusOf(error: unknown): number | undefined {
  const status = field(error, "status") ?? field(error, "statusCode");
  return typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined;
}
function typeOf(error: unknown): string {
  const name = field(error, "name");
  return typeof name === "string" && ["Error", "TypeError", "RangeError", "SyntaxError", "AggregateError", "FirebaseError", "ServiceFailure", "DOMException", "AbortError"].includes(name) ? name : "Error";
}
export function errorCategory(error: unknown): ErrorCategory {
  const code = diagnosticErrorCode(error)?.split("/").at(-1);
  const status = statusOf(error);
  if (error instanceof UserInputError || code === "validation" || code === "invalid-argument" || code === "weak-password" || code === "invalid-email") return "validation";
  if (["unauthenticated", "invalid-credential", "wrong-password", "user-not-found", "user-token-expired", "invalid-user-token", "requires-recent-login", "user-disabled"].includes(code || "") || status === 401) return "authentication";
  if (["permission-denied", "unauthorized"].includes(code || "") || status === 403) return "permission";
  if (["network-request-failed", "network-error", "offline"].includes(code || "")) return "network";
  if (["unavailable", "deadline-exceeded", "retry-limit-exceeded", "receipt-check-timeout", "upload-timeout", "internal", "resource-exhausted", "service-not-configured", "too-many-requests"].includes(code || "") || (status !== undefined && status >= 500)) return "unavailable";
  if (["not-found", "object-not-found"].includes(code || "") || status === 404 || status === 410) return "not-found";
  if (["already-exists", "aborted"].includes(code || "") || status === 409) return "conflict";
  if (diagnosticErrorCode(error)?.startsWith("storage/")) return "storage";
  // A TypeError can be a programming bug. Do not assume it is a network failure.
  return "unexpected";
}
const nextAction: Record<ErrorCategory, string> = {
  validation: "Check the information entered and try again.",
  permission: "Your account does not have permission for this operation. Contact an administrator.",
  authentication: "Check your sign-in details or sign in again, then retry.",
  network: "Check your connection and try again.",
  unavailable: "The service could not complete the request. Try again later; contact an administrator if it continues.",
  "not-found": "The requested record or file could not be found. Reload and check it is still available.",
  conflict: "The record may have changed. Reload it before trying again.",
  storage: "The file operation could not be completed. Retry; contact an administrator if it continues.",
  unexpected: "Try again; contact an administrator if the problem continues.",
};
function safeLabel(value: string): string {
  return /^[A-Za-z0-9 .:_/-]{1,120}$/.test(value) ? value : "application operation";
}
function safeIdentifiers(input: ErrorContext["identifiers"]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ["recordId", "transactionId", "eventId", "section"] as const) {
    const value = input?.[key];
    if (typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value)) result[key] = value;
  }
  return result;
}
function stackLocations(error: unknown): string[] | undefined {
  const stack = field(error, "stack");
  if (typeof stack !== "string") return undefined;
  // Omit exception text, function names, hosts, paths and query strings. Keep only
  // source basenames and line/column coordinates; raw stacks can include user data.
  const locations = stack.split("\n").slice(1).flatMap((line) => {
    const match = line.match(/(?:\/|\\)([A-Za-z0-9_-]+\.(?:js|jsx|ts|tsx)):(\d+):(\d+)\)?$/);
    return match ? [`${match[1]}:${match[2]}:${match[3]}`] : [];
  }).slice(0, 12);
  return locations.length ? locations : undefined;
}
export function reportApplicationError(error: unknown, context: ErrorContext): ReportedError {
  const key = `${context.area}:${context.operation}`;
  const cache = error && typeof error === "object" ? reports.get(error) : undefined;
  const previous = cache?.get(key);
  if (previous) return previous;
  const category = errorCategory(error);
  const code = diagnosticErrorCode(error);
  const status = statusOf(error);
  const backendReference = field(error, "backendReference");
  const reference = typeof backendReference === "string" && /^ERR-[A-F0-9]{12}$/.test(backendReference) ? backendReference : `ERR-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  const causes: ErrorDiagnostic["causes"] = [];
  const seen = new Set<unknown>([error]);
  let cause = field(error, "cause");
  while (cause && !seen.has(cause) && causes.length < 5) {
    seen.add(cause);
    causes.push({ type: typeOf(cause), code: diagnosticErrorCode(cause), status: statusOf(cause) });
    cause = field(cause, "cause");
  }
  const diagnostic: ErrorDiagnostic = {
    reference, timestamp: new Date().toISOString(), environment,
    area: safeLabel(context.area), operation: safeLabel(context.operation), category, code, status,
    type: typeOf(error),
    // Original message/cause remain accessible in memory, never in console or storage.
    message: code ? `Operation rejected with ${code}` : "Original exception text withheld for privacy",
    stack: stackLocations(error), causes, identifiers: safeIdentifiers(context.identifiers),
  };
  const description = error instanceof UserInputError || error instanceof UserFacingError ? error.message : context.userMessage || `${safeLabel(context.operation)} failed.`;
  const result = { userMessage: `${description} ${nextAction[category]} Reference: ${reference}`, diagnostic, cause: error };
  Object.defineProperty(result, "cause", { value: error, enumerable: false });
  if (error && typeof error === "object") {
    const entries = cache ?? new Map<string, ReportedError>();
    entries.set(key, result);
    reports.set(error, entries);
  }
  console.error("Application failure", diagnostic);
  return result;
}
export function applicationErrorMessage(error: unknown, userMessage: string, area: string, operation = userMessage): string {
  return reportApplicationError(error, { area, operation, userMessage }).userMessage;
}

/** Saved data must not be reported as a failed write when notification fails. */
export function reportSecondaryFailure(error: unknown, context: ErrorContext): ReportedError {
  const report = reportApplicationError(error, { ...context, userMessage: "The record was saved, but its email notification failed. Check notification status before sending again." });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("application-warning", { detail: report.userMessage }));
  return report;
}
