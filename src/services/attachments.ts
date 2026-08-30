import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "../firebase";
import { financeReceiptStoragePath, validateAttachmentUpload } from "./attachmentLogic";

export interface StoredAttachment {
  id: string;
  path: string;
  fileName: string;
  contentType: string;
  size: number;
  downloadUrl: string;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to upload attachments.");
  return uid;
}

export async function uploadFinanceReceipt(section: string, transactionId: string, file: File): Promise<StoredAttachment> {
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
  await uploadBytes(storageRef, file, {
    contentType: validated.contentType,
    customMetadata: {
      ownerType: validated.ownerType,
      ownerId: validated.ownerId,
      section: validated.section,
      uploadedBy: uid,
      originalFileName: validated.fileName,
    },
  });
  return {
    id: attachmentId,
    path,
    fileName: validated.fileName,
    contentType: validated.contentType,
    size: validated.size,
    downloadUrl: await getDownloadURL(storageRef),
  };
}

export async function deleteStoredAttachment(path: string): Promise<void> {
  currentUid();
  await deleteObject(ref(storage, path));
}
