import { applicationErrorMessage } from "./applicationErrors.ts";
export type FirestoreFailureKind =
  | "permission"
  | "quota"
  | "index"
  | "unauthenticated"
  | "network"
  | "unknown";

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value.replace(/^firestore\//, "") : "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return String(error ?? "");
  const value = (error as { message?: unknown }).message;
  return typeof value === "string" ? value : "";
}

export function classifyFirestoreFailure(error: unknown): FirestoreFailureKind {
  const code = errorCode(error);
  const message = errorMessage(error).toLowerCase();

  if (code === "permission-denied" || message.includes("missing or insufficient permissions")) {
    return "permission";
  }
  if (code === "resource-exhausted" || message.includes("resource-exhausted") || message.includes("quota")) {
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
