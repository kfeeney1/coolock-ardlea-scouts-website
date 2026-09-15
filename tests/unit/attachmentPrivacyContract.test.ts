import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string): string {
  return readFileSync(path.resolve(relativePath), "utf8");
}

test("restricted receipt and gallery services do not mint persistent Firebase download URLs", () => {
  const restrictedServices = [
    "src/services/financeReceipts.ts",
    "src/services/eventGallery.ts",
  ];

  for (const file of restrictedServices) {
    const contents = source(file);
    assert.doesNotMatch(contents, /\bgetDownloadURL\b/, `${file} must use authenticated reads rather than persistent Firebase download-token URLs.`);
    assert.match(contents, /URL\.createObjectURL\(/, `${file} should expose authenticated blobs through short-lived browser object URLs.`);
    assert.match(contents, /URL\.revokeObjectURL\(/, `${file} must provide object URL cleanup.`);
  }
});

test("attachment lifecycle UI keeps explicit removal and retry affordances", () => {
  const receiptControl = source("src/components/finance/FinanceReceiptControl.tsx");
  const galleryDialog = source("src/components/admin/EventGalleryDialog.tsx");

  assert.match(receiptControl, /Remove receipt\?/);
  assert.match(receiptControl, /payment record will remain/i);
  assert.match(receiptControl, /Retry upload/);
  assert.match(receiptControl, /Receipt upload progress/);
  assert.match(galleryDialog, /revokeEventGalleryPhotoUrls/);
});
