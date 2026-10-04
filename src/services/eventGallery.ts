import { ServiceFailure } from "./applicationErrors.ts";
import { deleteObject, getBlob, getMetadata, listAll, ref, uploadBytesResumable } from "firebase/storage";

import { auth, storage } from "../firebase";
import { eventGalleryStoragePath, validateEventGalleryUpload } from "./attachmentLogic";
import { loadGalleryItems, completeGalleryUpload } from "./eventGalleryLoadLogic";

export interface EventGalleryPhoto {
  id: string;
  eventId: string;
  section: string;
  path: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  downloadUrl: string;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new ServiceFailure("You must be signed in to manage event gallery photos.", "auth/unauthenticated");
  return uid;
}

function safeStorageSegment(value: string, label: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!safe) throw new Error(`${label} is required.`);
  return safe;
}

async function authenticatedObjectUrl(path: string, contentType: string): Promise<string> {
  const blob = await getBlob(ref(storage, path));
  const typedBlob = blob.type || !contentType ? blob : blob.slice(0, blob.size, contentType);
  return URL.createObjectURL(typedBlob);
}

export function revokeEventGalleryPhotoUrls(photos: EventGalleryPhoto[]): void {
  for (const photo of photos) URL.revokeObjectURL(photo.downloadUrl);
}

export async function uploadEventGalleryPhoto(section: string, eventId: string, file: File): Promise<EventGalleryPhoto> {
  const uid = currentUid();
  const attachmentId = crypto.randomUUID();
  const validated = validateEventGalleryUpload({
    ownerType: "event-gallery",
    ownerId: eventId,
    section,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });
  const path = eventGalleryStoragePath(validated.section, validated.ownerId, attachmentId, validated.safeFileName);
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: validated.contentType,
    customMetadata: {
      ownerType: validated.ownerType,
      ownerId: validated.ownerId,
      section: validated.section,
      uploadedBy: uid,
      originalFileName: validated.fileName,
    },
  });

  await completeGalleryUpload(task, 60000);

  return {
    id: attachmentId,
    eventId: validated.ownerId,
    section: validated.section,
    path,
    fileName: validated.fileName,
    contentType: validated.contentType,
    size: validated.size,
    uploadedBy: uid,
    downloadUrl: URL.createObjectURL(file),
  };
}

export async function loadEventGalleryPhotos(section: string, eventId: string): Promise<EventGalleryPhoto[]> {
  currentUid();
  const safeSection = safeStorageSegment(section, "Event gallery section");
  const safeEventId = safeStorageSegment(eventId, "Event gallery event id");
  const eventRef = ref(storage, `attachments/event-gallery/${safeSection}/${safeEventId}`);
  const result = await listAll(eventRef);
  const files = result.prefixes.length > 0
    ? [...result.items, ...(await Promise.all(result.prefixes.map((prefix) => listAll(prefix)))).flatMap((nested) => nested.items)]
    : result.items;

  return loadGalleryItems(files, async (item): Promise<EventGalleryPhoto | null> => {
      const metadata = await getMetadata(item);
      if (
        metadata.customMetadata?.ownerType !== "event-gallery" ||
        metadata.customMetadata?.ownerId !== eventId.trim() ||
        metadata.customMetadata?.section !== section.trim()
      ) return null;

      const pathParts = item.fullPath.split("/");
      const attachmentId = pathParts.at(-2) || "";
      const contentType = metadata.contentType || "";
      return {
        id: attachmentId,
        eventId: metadata.customMetadata.ownerId,
        section: metadata.customMetadata.section,
        path: item.fullPath,
        fileName: metadata.customMetadata.originalFileName || item.name,
        contentType,
        size: metadata.size,
        uploadedBy: metadata.customMetadata.uploadedBy || "",
        downloadUrl: await authenticatedObjectUrl(item.fullPath, contentType),
      };
  }, revokeEventGalleryPhotoUrls);
}

export async function deleteEventGalleryPhoto(photo: Pick<EventGalleryPhoto, "path">): Promise<void> {
  currentUid();
  try {
    await deleteObject(ref(storage, photo.path));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "storage/object-not-found") return;
    throw error;
  }
}
