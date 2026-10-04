import assert from "node:assert/strict";
import { test } from "node:test";
import { loadReceiptMetadata } from "../../src/services/financeReceiptLoadLogic.ts";

test("empty receipt listing is a normal empty status", async () => {
  assert.deepEqual(await loadReceiptMetadata([], async () => { throw new Error("must not read"); }), []);
});

test("metadata loading retains transaction ownership and skips removed objects", async () => {
  const result = await loadReceiptMetadata(["original", "gone", "correction"], async (id) => {
    if (id === "gone") throw { code: "storage/object-not-found" };
    return { transactionId: id, fileName: `${id}.pdf` };
  });
  assert.deepEqual(result.map(r => r.transactionId), ["original", "correction"]);
});

test("permission and service errors propagate; a fresh retry can recover", async () => {
  for (const code of ["storage/unauthorized", "storage/unknown", "storage/retry-limit-exceeded"]) {
    const error = { code };
    await assert.rejects(loadReceiptMetadata([1], async () => { throw error; }), e => e === error);
    assert.deepEqual(await loadReceiptMetadata([1], async () => ({ transactionId: "original" })), [{ transactionId: "original" }]);
  }
});

test("metadata reads overlap within a bounded batch instead of waiting serially", async () => {
  let active = 0;
  let peak = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const result = loadReceiptMetadata([1, 2, 3, 4, 5], async id => {
    active++;
    peak = Math.max(peak, active);
    await gate;
    active--;
    return id;
  });
  assert.equal(active, 4);
  release();
  assert.deepEqual(await result, [1, 2, 3, 4, 5]);
  assert.equal(peak, 4);
});
