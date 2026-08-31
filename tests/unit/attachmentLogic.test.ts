import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ATTACHMENT_BYTES,
  eventGalleryStoragePath,
  financeReceiptStoragePath,
  sanitiseAttachmentFileName,
  validateAttachmentUpload,
  validateEventGalleryUpload,
} from "../../src/services/attachmentLogic.ts";

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

test("event gallery validation is image-only", () => {
  const image = validateEventGalleryUpload({ ownerType: "event-gallery", ownerId: "event-1", section: "Scouts", fileName: "Camp photo.jpg", contentType: "image/jpeg", size: 2048 });
  assert.equal(image.ownerId, "event-1");
  assert.equal(image.safeFileName, "Camp-photo.jpg");
  assert.throws(() => validateEventGalleryUpload({ ownerType: "event-gallery", ownerId: "event-1", section: "Scouts", fileName: "programme.pdf", contentType: "application/pdf", size: 2048 }), /JPEG, PNG or WebP/);
  assert.throws(() => validateEventGalleryUpload({ ownerType: "finance-receipt", ownerId: "event-1", section: "Scouts", fileName: "photo.jpg", contentType: "image/jpeg", size: 2048 }), /event-gallery owner type/);
});

test("event gallery storage paths bind files to section and event", () => {
  assert.equal(
    eventGalleryStoragePath("Scout Section", "summer camp 2026", "photo 123", "Patrol / hike.jpg"),
    "attachments/event-gallery/Scout-Section/summer-camp-2026/photo-123/Patrol-hike.jpg",
  );
});
