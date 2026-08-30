import { getDownloadURL, getMetadata, listAll, ref } from "firebase/storage";
import { auth, storage } from "../firebase";
import { uploadFinanceReceipt } from "./attachments";
import { recordAuditEvent } from "./auditLog";

export interface FinanceReceipt {
  id: string;
  transactionId: string;
  section: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  size: number;
  downloadUrl: string;
  uploadedBy: string;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to manage finance receipts.");
  return uid;
}

export async function loadFinanceReceipts(section: string): Promise<FinanceReceipt[]> {
  currentUid();
  const root = ref(storage, `attachments/finance-receipts/${section}`);
  const attachmentFolders = await listAll(root);
  const receipts: FinanceReceipt[] = [];
  for (const folder of attachmentFolders.prefixes) {
    const files = await listAll(folder);
    for (const item of files.items) {
      const metadata = await getMetadata(item);
      const custom = metadata.customMetadata ?? {};
      if (custom.ownerType !== "finance-receipt" || custom.section !== section || !custom.ownerId) continue;
      receipts.push({
        id: folder.name,
        transactionId: custom.ownerId,
        section,
        storagePath: item.fullPath,
        fileName: custom.originalFileName || item.name,
        contentType: metadata.contentType || "application/octet-stream",
        size: metadata.size,
        downloadUrl: await getDownloadURL(item),
        uploadedBy: custom.uploadedBy || "",
      });
    }
  }
  return receipts;
}

export async function addFinanceReceipt(transactionId: string, section: string, file: File): Promise<FinanceReceipt> {
  const uid = currentUid();
  const stored = await uploadFinanceReceipt(section, transactionId, file);
  void recordAuditEvent({ category: "finance", action: "receipt-uploaded", targetId: transactionId, targetLabel: stored.fileName, description: `Receipt attached to finance transaction ${transactionId}`, section });
  return { id: stored.id, transactionId, section, storagePath: stored.path, fileName: stored.fileName, contentType: stored.contentType, size: stored.size, downloadUrl: stored.downloadUrl, uploadedBy: uid };
}
