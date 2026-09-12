import { getBlob, getMetadata, listAll, ref } from "firebase/storage";
import { auth, storage } from "../firebase";
import { deleteStoredAttachment, uploadFinanceReceipt } from "./attachments";
import { recordAuditEvent } from "./auditLog";

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

async function authenticatedObjectUrl(path: string, contentType: string): Promise<string> {
  const blob = await getBlob(ref(storage, path));
  const typedBlob = blob.type || !contentType ? blob : blob.slice(0, blob.size, contentType);
  return URL.createObjectURL(typedBlob);
}

export function revokeFinanceReceiptUrls(receipts: FinanceReceipt[]): void {
  for (const receipt of receipts) URL.revokeObjectURL(receipt.viewUrl);
}

export async function loadFinanceReceipts(section: string): Promise<FinanceReceipt[]> {
  currentUid();
  const root = ref(storage, `attachments/finance-receipts/${section}`);
  const attachmentFolders = await listAll(root);
  const receipts: FinanceReceipt[] = [];
  try {
    for (const folder of attachmentFolders.prefixes) {
      const files = await listAll(folder);
      for (const item of files.items) {
        const metadata = await getMetadata(item);
        const custom = metadata.customMetadata ?? {};
        if (custom.ownerType !== "finance-receipt" || custom.section !== section || !custom.ownerId) continue;
        const contentType = metadata.contentType || "application/octet-stream";
        receipts.push({
          id: folder.name,
          transactionId: custom.ownerId,
          section,
          storagePath: item.fullPath,
          fileName: custom.originalFileName || item.name,
          contentType,
          size: metadata.size,
          viewUrl: await authenticatedObjectUrl(item.fullPath, contentType),
          uploadedBy: custom.uploadedBy || "",
        });
      }
    }
    return receipts;
  } catch (error) {
    revokeFinanceReceiptUrls(receipts);
    throw error;
  }
}

export async function addFinanceReceipt(transactionId: string, section: string, file: File): Promise<void> {
  currentUid();
  const stored = await uploadFinanceReceipt(section, transactionId, file);
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
