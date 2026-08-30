import assert from "node:assert/strict";
import test from "node:test";
import { MAX_ATTACHMENT_BYTES, financeReceiptStoragePath, sanitiseAttachmentFileName, validateAttachmentUpload } from "../../src/services/attachmentLogic.ts";

test("attachment validation accepts supported receipt files and normalises names", () => {
  const result = validateAttachmentUpload({ ownerType: "finance-receipt", ownerId: "tx-1", section: " Cubs ", fileName: " Shop receipt (1).JPG ", contentType: "image/jpeg", size: 1234 });
  assert.equal(result.section, "Cubs");
  assert.equal(result.safeFileName, "Shop-receipt-1-.JPG");
});

test("attachment validation rejects empty, oversized and unsupported files", () => {
  assert.throws(() => validateAttachmentUpload({ ownerType: "finance-receipt", ownerId: "tx", section: "Cubs", fileName: "x.exe", contentType: "application/octet-stream", size: 10 }), /JPEG/);
  assert.throws(() => validateAttachmentUpload({ ownerType: "finance-receipt", ownerId: "tx", section: "Cubs", fileName: "x.pdf", contentType: "application/pdf", size: 0 }), /10 MB/);
  assert.throws(() => validateAttachmentUpload({ ownerType: "finance-receipt", ownerId: "tx", section: "Cubs", fileName: "x.pdf", contentType: "application/pdf", size: MAX_ATTACHMENT_BYTES + 1 }), /10 MB/);
});

test("receipt storage paths are deterministic and path-safe", () => {
  assert.equal(financeReceiptStoragePath("Cub Scouts", "receipt 123", "Tesco / receipt.pdf"), "attachments/finance-receipts/Cub-Scouts/receipt-123/Tesco-receipt.pdf");
  assert.equal(sanitiseAttachmentFileName("receipt 2026.pdf"), "receipt-2026.pdf");
});
