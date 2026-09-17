import { deleteObject, getBlob, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "../firebase";
import { meetingDocumentStoragePath, validateMeetingDocument } from "./attachmentLogic";

export type MeetingDocument = { path: string; fileName: string; contentType: string; size: number };

export async function uploadMeetingDocument(section: string, meetingId: string, file: File): Promise<MeetingDocument> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to upload meeting documents.");
  const validated = validateMeetingDocument({ ownerType: "meeting-document", ownerId: meetingId, section, fileName: file.name, contentType: file.type, size: file.size });
  const path = meetingDocumentStoragePath(section, meetingId, crypto.randomUUID(), validated.safeFileName);
  await uploadBytes(ref(storage, path), file, { contentType: validated.contentType, customMetadata: { ownerType: "meeting-document", ownerId: meetingId, section, uploadedBy: uid, originalFileName: validated.fileName } });
  return { path, fileName: validated.fileName, contentType: validated.contentType, size: validated.size };
}

export async function removeMeetingDocument(path: string): Promise<void> { await deleteObject(ref(storage, path)); }

export async function openMeetingDocument(document: MeetingDocument): Promise<void> {
  const blob = await getBlob(ref(storage, document.path));
  const url = URL.createObjectURL(blob); window.open(url, "_blank", "noopener,noreferrer"); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
