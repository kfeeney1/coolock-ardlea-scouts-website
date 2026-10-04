import { applicationErrorMessage, diagnosticErrorCode } from "./applicationErrors.ts";
export type FirestoreFailureKind =
  | "permission"
  | "quota"
  | "index"
  | "unauthenticated"
  | "network"
  | "unknown";

export function classifyFirestoreFailure(error: unknown): FirestoreFailureKind {
  const code = diagnosticErrorCode(error)?.replace(/^firestore\//, "");
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (code === "permission-denied") {
    return "permission";
  }
  if (code === "resource-exhausted") {
    return "quota";
  }
  if (code === "failed-precondition" && message.includes("index")) {
    return "index";
  }
  if (code === "unauthenticated") return "unauthenticated";
  if (code === "unavailable" || code === "deadline-exceeded" || code === "network-request-failed") {
    return "network";
  }
  return "unknown";
}

export function firestoreFailureMessage(error: unknown, fallback: string): string {
  return applicationErrorMessage(error, fallback, "Firestore");
}
