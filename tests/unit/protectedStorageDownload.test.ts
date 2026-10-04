import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchProtectedStorageBlob } from "../../src/services/protectedStorageDownload.ts";

const response = (status: number, body = "receipt") => new Response(body, { status });

test("SW-281 protected download sends an ID token to the canonical object media endpoint", async () => {
  let seenUrl = "";
  let seenAuth = "";
  const blob = await fetchProtectedStorageBlob("bucket.firebasestorage.app", "attachments/finance-receipts/Scouts/id/a b.pdf", "token-value", {
    fetchImpl: (async (input, init) => {
      seenUrl = String(input);
      seenAuth = new Headers(init?.headers).get("Authorization") || "";
      return response(200);
    }) as typeof fetch,
  });
  assert.equal(await blob.text(), "receipt");
  assert.match(seenUrl, /bucket\.firebasestorage\.app\/o\/attachments%2Ffinance-receipts%2FScouts%2Fid%2Fa%20b\.pdf\?alt=media$/);
  assert.equal(seenAuth, "Bearer token-value");
});

test("SW-281 protected download honors an explicit emulator endpoint", async () => {
  let seenUrl = "";
  await fetchProtectedStorageBlob("demo-bucket", "attachments/receipt.pdf", "token", {
    endpointBase: "http://127.0.0.1:9199/",
    fetchImpl: (async (input) => { seenUrl = String(input); return response(200); }) as typeof fetch,
  });
  assert.equal(seenUrl, "http://127.0.0.1:9199/v0/b/demo-bucket/o/attachments%2Freceipt.pdf?alt=media");
});

test("SW-281 protected download preserves authorization, missing-object and service distinctions", async () => {
  for (const [status, code] of [[401, "storage/unauthenticated"], [403, "storage/unauthorized"], [404, "storage/object-not-found"], [429, "storage/retry-limit-exceeded"], [503, "storage/unknown"]] as const) {
    await assert.rejects(
      fetchProtectedStorageBlob("bucket", "path", "token", { fetchImpl: (async () => response(status)) as typeof fetch }),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === code && "status" in error && error.status === status,
    );
  }
});

test("SW-281 protected download has its own abortable timeout instead of hanging behind the UI deadline", async () => {
  const hangingFetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  })) as typeof fetch;
  await assert.rejects(
    fetchProtectedStorageBlob("bucket", "path", "token", { timeoutMs: 5, fetchImpl: hangingFetch }),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "storage/download-timeout",
  );
});

test("SW-281 protected download rejects missing auth/configuration before network access", async () => {
  let calls = 0;
  const fetchImpl = (async () => { calls++; return response(200); }) as typeof fetch;
  await assert.rejects(fetchProtectedStorageBlob("", "path", "token", { fetchImpl }), (e: unknown) => typeof e === "object" && e !== null && "code" in e && e.code === "storage/bucket-not-configured");
  await assert.rejects(fetchProtectedStorageBlob("bucket", "path", "", { fetchImpl }), (e: unknown) => typeof e === "object" && e !== null && "code" in e && e.code === "storage/unauthenticated");
  assert.equal(calls, 0);
});


test("SW-286 protected download classifies fetch rejection as network/CORS-level failure without leaking browser text", async () => {
  await assert.rejects(
    fetchProtectedStorageBlob("bucket", "path", "token", {
      fetchImpl: (async () => { throw new TypeError("Failed to fetch PRIVATE_SIGNED_URL"); }) as typeof fetch,
    }),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "storage/network-error" && !JSON.stringify(error).includes("PRIVATE_SIGNED_URL"),
  );
});
