import { maintenanceTaskStore } from "./maintenanceTaskStore";
import type { MaintenanceDocument } from "./maintenanceDocumentStore";
import { getBlob, ref } from "firebase/storage";
import { auth, db, storage } from "../firebase";
import { requireMaintenanceRuntime } from "./maintenanceRuntime";
import { documentDigest, documentPath, maintenanceDocumentStore } from "./maintenanceDocumentStore";
import { UserFacingError } from "./applicationErrors";
export { checkMaintenanceMembership } from "./maintenanceMembership";
export type { MaintenanceDocument } from "./maintenanceDocumentStore";
const documents = maintenanceDocumentStore(db, storage, () => auth.currentUser?.uid);
export async function listMaintenanceDocuments(after = "") { requireMaintenanceRuntime(); return documents.list(after); }
export async function uploadMaintenanceDocument(file: File, id: string) { requireMaintenanceRuntime(); return documents.upload(file, id); }
export async function downloadMaintenanceDocument(id: string, open: boolean) {
  requireMaintenanceRuntime();
  const record = await documents.ready(id);
  const blob = await getBlob(ref(storage, documentPath(id)));
  if (await documentDigest(new Uint8Array(await blob.arrayBuffer())) !== record.sha256) throw new UserFacingError("Document content does not match its retained record.");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.rel = "noopener noreferrer";
  if (open) anchor.target = "_blank"; else anchor.download = record.fileName;
  anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export type { MaintenanceTask } from "./maintenanceTaskStore";
const taskStore = maintenanceTaskStore(db, () => auth.currentUser?.uid);
export async function maintenanceTasks<T>(input: Record<string, unknown>): Promise<T> {
  requireMaintenanceRuntime();
  return await taskStore(input) as T;
}
export async function maintenanceDocumentChoices() {
  const documents: MaintenanceDocument[] = []; let after = "";
  do { const page = await listMaintenanceDocuments(after); documents.push(...page.documents.filter(doc => doc.state === "ready")); after = page.next; } while (after);
  return documents;
}
