// Keep diagnostic text/payloads out of delivery logs. A reference joins the
// browser report to this server record without exposing recipients or bodies.
export function backendFailureDiagnostic(error, operation, environment = "unknown") {
  const code = typeof error?.code === "string" && /^(?:auth|firestore|storage|functions|backend)\/[a-z-]{2,60}$/.test(error.code) ? error.code : undefined;
  const explicitStatus = error?.status;
  // Legacy upstream adapters put only HTTP status in their static error text.
  const statusMatch = typeof error?.message === "string" ? error.message.match(/(?:failed with|returned)\s+(\d{3})/) : null;
  const candidateStatus = explicitStatus ?? (statusMatch ? Number(statusMatch[1]) : undefined);
  const status = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : undefined;
  const message = typeof error?.message === "string" ? error.message : "";
  const upstream = /^(?:Firestore |Reminder persistence )/.test(message) ? "firestore"
    : /^Resend returned /.test(message) ? "email-provider"
    : /^Firebase service-account token /.test(message) ? "authentication"
    : /is not configured\.$/.test(message) ? "configuration" : "unknown";
  return {
    upstream,
    schema: "application-error-v1", reference: `ERR-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
    timestamp: new Date().toISOString(), environment: ["production", "test"].includes(environment) ? environment : "unknown",
    area: "Email backend", operation: /^\/[a-z-]{1,60}$/.test(operation) ? operation : "backend request",
    code: code || "backend/request-failed", status,
    type: error instanceof Error ? "Error" : "Unknown",
  };
}
