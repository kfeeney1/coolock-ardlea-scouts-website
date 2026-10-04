// Listing/status never downloads receipt bodies. Missing objects can disappear
// between list and metadata reads; authorization and service errors propagate.
export async function loadReceiptMetadata<TItem, TReceipt>(
  items: TItem[],
  read: (item: TItem) => Promise<TReceipt | null>,
): Promise<TReceipt[]> {
  const receipts: TReceipt[] = [];
  for (let offset = 0; offset < items.length; offset += 4) {
    const batch = await Promise.all(items.slice(offset, offset + 4).map(async (item) => {
      try { return await read(item); }
      catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "storage/object-not-found") return null;
        throw error;
      }
    }));
    for (const receipt of batch) if (receipt !== null) receipts.push(receipt);
  }
  return receipts;
}
