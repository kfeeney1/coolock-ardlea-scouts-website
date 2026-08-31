export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const ALLOWED_EVENT_GALLERY_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AttachmentOwnerType = "finance-receipt" | "event-gallery";

export interface AttachmentUploadInput {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  section: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface ValidatedAttachmentUpload extends AttachmentUploadInput {
  safeFileName: string;
}

export function sanitiseAttachmentFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!safe || safe === "." || safe === "..") throw new Error("Attachment file name is required.");
  return safe.slice(0, 120);
}

export function validateAttachmentUpload(input: AttachmentUploadInput): ValidatedAttachmentUpload {
  const ownerId = input.ownerId.trim();
  const section = input.section.trim();
  if (!ownerId) throw new Error("Attachment owner is required.");
  if (!section) throw new Error("Attachment section is required.");
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment must be between 1 byte and 10 MB.");
  }
  if (!ALLOWED_ATTACHMENT_TYPES.includes(input.contentType as typeof ALLOWED_ATTACHMENT_TYPES[number])) {
    throw new Error("Attachment must be a JPEG, PNG, WebP image or PDF.");
  }
  return {
    ...input,
    ownerId,
    section,
    fileName: input.fileName.trim(),
    safeFileName: sanitiseAttachmentFileName(input.fileName),
  };
}

export function validateEventGalleryUpload(input: AttachmentUploadInput): ValidatedAttachmentUpload {
  if (input.ownerType !== "event-gallery") throw new Error("Event gallery uploads must use the event-gallery owner type.");
  const validated = validateAttachmentUpload(input);
  if (!ALLOWED_EVENT_GALLERY_TYPES.includes(validated.contentType as typeof ALLOWED_EVENT_GALLERY_TYPES[number])) {
    throw new Error("Event gallery uploads must be a JPEG, PNG or WebP image.");
  }
  return validated;
}

function sanitiseStorageSegment(value: string, errorMessage: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!safe) throw new Error(errorMessage);
  return safe;
}

export function financeReceiptStoragePath(section: string, attachmentId: string, fileName: string): string {
  const safeSection = sanitiseStorageSegment(section, "Receipt section is required.");
  const safeAttachmentId = sanitiseStorageSegment(attachmentId, "Receipt attachment id is required.");
  return `attachments/finance-receipts/${safeSection}/${safeAttachmentId}/${sanitiseAttachmentFileName(fileName)}`;
}

export function eventGalleryStoragePath(section: string, eventId: string, attachmentId: string, fileName: string): string {
  const safeSection = sanitiseStorageSegment(section, "Event gallery section is required.");
  const safeEventId = sanitiseStorageSegment(eventId, "Event gallery event id is required.");
  const safeAttachmentId = sanitiseStorageSegment(attachmentId, "Event gallery attachment id is required.");
  return `attachments/event-gallery/${safeSection}/${safeEventId}/${safeAttachmentId}/${sanitiseAttachmentFileName(fileName)}`;
}
