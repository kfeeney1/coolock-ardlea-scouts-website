import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../firebase";
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
  downloadUrl: string;
  uploadedBy: string;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to manage finance receipts.");
  return uid;
}

function mapReceipt(id: string, data: Record<string, unknown>): FinanceReceipt | null {
  if (typeof data.transactionId !== "string" || typeof data.section !== "string" || typeof data.storagePath !== "string") return null;
  if (typeof data.fileName !== "string" || typeof data.contentType !== "string" || typeof data.size !== "number") return null;
  if (typeof data.downloadUrl !== "string" || typeof data.uploadedBy !== "string") return null;
  return { id, transactionId: data.transactionId, section: data.section, storagePath: data.storagePath, fileName: data.fileName, contentType: data.contentType, size: data.size, downloadUrl: data.downloadUrl, uploadedBy: data.uploadedBy };
}

export async function loadFinanceReceipts(section: string): Promise<FinanceReceipt[]> {
  const snapshot = await getDocs(query(collection(db, "financeReceipts"), where("section", "==", section)));
  return snapshot.docs.map((item) => mapReceipt(item.id, item.data())).filter((item): item is FinanceReceipt => item !== null);
}

export async function addFinanceReceipt(transactionId: string, section: string, file: File): Promise<FinanceReceipt> {
  const uid = currentUid();
  const stored = await uploadFinanceReceipt(section, transactionId, file);
  try {
    const result = await addDoc(collection(db, "financeReceipts"), {
      transactionId,
      section,
      storagePath: stored.path,
      fileName: stored.fileName,
      contentType: stored.contentType,
      size: stored.size,
      downloadUrl: stored.downloadUrl,
      uploadedBy: uid,
      uploadedAt: serverTimestamp(),
    });
    void recordAuditEvent({ category: "finance", action: "receipt-uploaded", targetId: transactionId, targetLabel: stored.fileName, description: `Receipt attached to finance transaction ${transactionId}`, section });
    return { id: result.id, transactionId, section, storagePath: stored.path, fileName: stored.fileName, contentType: stored.contentType, size: stored.size, downloadUrl: stored.downloadUrl, uploadedBy: uid };
  } catch (error) {
    await deleteStoredAttachment(stored.path).catch(() => undefined);
    throw error;
  }
}
