export type StorageDownloadError = Error & { code: string; status?: number };

function storageDownloadError(code: string, message: string, status?: number): StorageDownloadError {
  const error = new Error(message) as StorageDownloadError;
  error.name = "StorageDownloadError";
  error.code = code;
  if (status !== undefined) error.status = status;
  return error;
}

export async function fetchProtectedStorageBlob(
  bucket: string,
  path: string,
  idToken: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch; endpointBase?: string } = {},
): Promise<Blob> {
  if (!bucket) throw storageDownloadError("storage/bucket-not-configured", "Storage bucket is not configured.");
  if (!path) throw storageDownloadError("storage/invalid-argument", "Receipt storage path is missing.");
  if (!idToken) throw storageDownloadError("storage/unauthenticated", "Authentication token is unavailable.");

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 20_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpointBase = (options.endpointBase || "https://firebasestorage.googleapis.com").replace(/\/$/, "");
  const url = `${endpointBase}/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`;

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (response.ok) return await response.blob();

    const status = response.status;
    if (status === 401) throw storageDownloadError("storage/unauthenticated", "Receipt authentication was rejected.", status);
    if (status === 403) throw storageDownloadError("storage/unauthorized", "Receipt access was denied.", status);
    if (status === 404) throw storageDownloadError("storage/object-not-found", "Receipt file was not found.", status);
    if (status === 408 || status === 429) throw storageDownloadError("storage/retry-limit-exceeded", "Receipt download should be retried.", status);
    throw storageDownloadError("storage/unknown", "Receipt download failed.", status);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw storageDownloadError("storage/download-timeout", "Receipt download timed out.");
    }
    // Browser fetch rejects before an HTTP response for connectivity, DNS and
    // CORS enforcement. Preserve that boundary as a safe network classification
    // instead of leaking or guessing from the browser's raw TypeError message.
    if (error instanceof TypeError) {
      const networkError = storageDownloadError("storage/network-error", "Protected Storage request failed before a response was available.");
      Object.defineProperty(networkError, "cause", { value: error, enumerable: false });
      throw networkError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
