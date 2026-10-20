import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import app, { appEnvironment } from "../firebase";
const functions = getFunctions(app, "europe-west1");
if (appEnvironment === "local") connectFunctionsEmulator(functions, "127.0.0.1", 5001);
export async function checkMaintenanceMembership() {
  return (await httpsCallable<void, {member: boolean}>(functions, "maintenanceAccess")()).data.member;
}
export type MaintenanceDocument = { id: string; fileName: string; contentType: string; size: number; uploadedBy: string; uploadedAt: number; state: "pending" | "ready" };
export async function listMaintenanceDocuments(after = "") {
  return (await httpsCallable<{action: string; after: string}, {documents: MaintenanceDocument[]; next: string}>(functions, "maintenanceDocuments")({action: "list", after})).data;
}
export async function uploadMaintenanceDocument(file: File, id: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  await httpsCallable(functions, "maintenanceDocuments", {timeout: 120000})({action: "upload", id, fileName: file.name, contentType: file.type, base64: btoa(binary)});
}
export async function downloadMaintenanceDocument(id: string, open: boolean) {
  const result = (await httpsCallable<{action: string; id: string}, {fileName: string; contentType: string; base64: string}>(functions, "maintenanceDocuments")({action: "download", id})).data;
  const bytes = Uint8Array.from(atob(result.base64), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], {type: result.contentType}));
  const anchor = document.createElement("a"); anchor.href = url; anchor.rel = "noopener noreferrer";
  if (open) anchor.target = "_blank"; else anchor.download = result.fileName;
  anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export type MaintenanceTask = { id: string; description: string; documentIds: string[]; status: "open" | "complete"; assigneeUid: string; assigneeName: string; revision: number; createdAt: number };
export async function maintenanceTasks<T>(input: Record<string, unknown>): Promise<T> {
  return (await httpsCallable<Record<string, unknown>, T>(functions, "maintenanceTasks")(input)).data;
}
export async function maintenanceDocumentChoices() {
  const documents: MaintenanceDocument[] = []; let after = "";
  do { const page = await listMaintenanceDocuments(after); documents.push(...page.documents.filter(doc => doc.state === "ready")); after = page.next; } while (after);
  return documents;
}
