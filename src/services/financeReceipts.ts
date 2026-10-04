import { getBlob, getMetadata, listAll, ref } from "firebase/storage";
import { auth, storage } from "../firebase";
import { deleteStoredAttachment, uploadFinanceReceipt, type AttachmentUploadProgress } from "./attachments";
import { recordAuditEvent } from "./auditLog";
import { loadReceiptMetadata } from "./financeReceiptLoadLogic";

export interface FinanceReceipt {
  id: string;
  transactionId: string;
  section: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  size: number;
  viewUrl: string;
  uploadedBy: string;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to manage finance receipts.");
  return uid;
}

export async function openFinanceReceipt(receipt: FinanceReceipt): Promise<string> {
  currentUid();
  const { storagePath: path, contentType } = receipt;
  const blob = await getBlob(ref(storage, path));
  const typedBlob = blob.type || !contentType ? blob : blob.slice(0, blob.size, contentType);
  return URL.createObjectURL(typedBlob);
}

export function revokeFinanceReceiptUrls(receipts: FinanceReceipt[]): void {
  for (const receipt of receipts) if (receipt.viewUrl) URL.revokeObjectURL(receipt.viewUrl);
}

export async function loadFinanceReceipts(section: string): Promise<FinanceReceipt[]> {
  currentUid();
  const root = ref(storage, `attachments/finance-receipts/${section}`);
  const attachmentFolders = await listAll(root);
  const items = await loadReceiptMetadata(attachmentFolders.prefixes, async (folder) => (await listAll(folder)).items);
  return loadReceiptMetadata(items.flat(), async (item): Promise<FinanceReceipt | null> => {
    const metadata = await getMetadata(item);
    const custom = metadata.customMetadata ?? {};
    if (custom.ownerType !== "finance-receipt" || custom.section !== section || !custom.ownerId) return null;
    const contentType = metadata.contentType || "application/octet-stream";
    return {
      id: item.parent?.name || item.name,
      transactionId: custom.ownerId,
      section,
      storagePath: item.fullPath,
      fileName: custom.originalFileName || item.name,
      contentType,
      size: metadata.size,
      // Status and reporting require metadata only. Download the protected
      // file when the user opens it, never every file in the section here.
      viewUrl: "",
      uploadedBy: custom.uploadedBy || "",
    };
  });
}

export async function addFinanceReceipt(
  transactionId: string,
  section: string,
  file: File,
  onProgress?: (progress: AttachmentUploadProgress) => void,
): Promise<void> {
  currentUid();
  const stored = await uploadFinanceReceipt(section, transactionId, file, onProgress);
  void recordAuditEvent({ category: "finance", action: "receipt-uploaded", targetId: transactionId, targetLabel: stored.fileName, description: `Receipt attached to finance transaction ${transactionId}`, section });
}

export async function removeFinanceReceipt(receipt: Pick<FinanceReceipt, "storagePath" | "transactionId" | "section" | "fileName">): Promise<void> {
  currentUid();
  await deleteStoredAttachment(receipt.storagePath);
  void recordAuditEvent({
    category: "finance",
    action: "receipt-deleted",
    targetId: receipt.transactionId,
    targetLabel: receipt.fileName,
    description: `Receipt removed from finance transaction ${receipt.transactionId}`,
    section: receipt.section,
  });
}
