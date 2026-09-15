import { deleteObject, ref, uploadBytesResumable } from "firebase/storage";
import { auth, storage } from "../firebase";
import { financeReceiptStoragePath, validateAttachmentUpload } from "./attachmentLogic";

export interface StoredAttachment {
  id: string;
  path: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface AttachmentUploadProgress {
  bytesTransferred: number;
  totalBytes: number;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to upload attachments.");
  return uid;
}

export async function uploadFinanceReceipt(
  section: string,
  transactionId: string,
  file: File,
  onProgress?: (progress: AttachmentUploadProgress) => void,
): Promise<StoredAttachment> {
  const uid = currentUid();
  const attachmentId = crypto.randomUUID();
  const validated = validateAttachmentUpload({
    ownerType: "finance-receipt",
    ownerId: transactionId,
    section,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });
  const path = financeReceiptStoragePath(validated.section, attachmentId, validated.safeFileName);
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

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.({ bytesTransferred: snapshot.bytesTransferred, totalBytes: snapshot.totalBytes }),
      reject,
      resolve,
    );
  });

  return {
    id: attachmentId,
    path,
    fileName: validated.fileName,
    contentType: validated.contentType,
    size: validated.size,
  };
}

export async function deleteStoredAttachment(path: string): Promise<void> {
  currentUid();
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "storage/object-not-found") return;
    throw error;
  }
}
