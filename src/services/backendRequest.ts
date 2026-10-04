import { diagnosticErrorCode, ServiceFailure } from "./applicationErrors.ts";
/** Never read an error response body: it can contain private backend payloads. */
export async function requestBackend<T>(url: string, init: RequestInit, request: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try {
    response = await request(url, init);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    const code = diagnosticErrorCode(cause);
    const isNetwork = ["Failed to fetch", "fetch failed", "NetworkError when attempting to fetch resource."].includes(message)
      || code === "auth/network-request-failed" || code === "backend/network-error";
    throw new ServiceFailure("Backend request could not complete.", isNetwork ? "backend/network-error" : "backend/request-failed", { cause });
  }
  if (!response.ok) {
    throw new ServiceFailure("Backend rejected the request.", "backend/request-failed", { status: response.status, backendReference: response.headers.get("X-Error-Reference") || undefined });
  }
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch (cause) { throw new ServiceFailure("Backend returned an invalid response.", "backend/invalid-response", { cause }); }
}
