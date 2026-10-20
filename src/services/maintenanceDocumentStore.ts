import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, type Firestore } from "firebase/firestore";
import { getMetadata, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";
import { validateAttachmentUpload } from "./attachmentLogic.ts";
import { UserFacingError } from "./applicationErrors.ts";
export type MaintenanceDocument = { id: string; fileName: string; contentType: string; size: number; sha256: string; uploadedBy: string; uploadedAt: number; state: "pending" | "ready" };
const root = "maintenance/group/documents";
export const documentPath = (id: string) => {
  if (!/^[a-zA-Z0-9-]{20,64}$/.test(id)) throw new UserFacingError("Invalid document reference.");
  return `maintenance-documents/${id}`;
};
export async function documentDigest(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}
export function maintenanceDocumentStore(db: Firestore, storage: FirebaseStorage, uid: () => string | undefined) {
  const list = async (after = "") => {
    if (after) documentPath(after);
    const cursor = after ? await getDoc(doc(db, root, after)) : null;
    if (cursor && !cursor.exists()) throw new UserFacingError("Refresh the document list.");
    const page = await getDocs(query(collection(db, root), orderBy("uploadedAt", "desc"), ...(cursor ? [startAfter(cursor)] : []), limit(50)));
    return {documents: page.docs.map(item => { const data = item.data(); return {id: item.id, ...data, uploadedAt: typeof data.uploadedAt === "number" ? data.uploadedAt : data.uploadedAt.toMillis()} as MaintenanceDocument; }), next: page.size === 50 ? page.docs.at(-1)!.id : ""};
  };
  const upload = async (file: File, id: string) => {
    const owner = uid();
    if (!owner) throw new UserFacingError("Sign in to upload a document.");
    const path = documentPath(id);
    const validated = validateAttachmentUpload({ownerType: "finance-receipt", ownerId: id, section: "Group", fileName: file.name, contentType: file.type, size: file.size});
    if (validated.fileName.length > 240) throw new UserFacingError("Document names must be at most 240 characters.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = await documentDigest(bytes);
    const record = doc(db, root, id);
    await runTransaction(db, async tx => {
      const previous = (await tx.get(record)).data();
      if (previous) {
        if (previous.uploadedBy !== owner || previous.sha256 !== sha256 || previous.fileName !== validated.fileName || previous.contentType !== validated.contentType || previous.size !== bytes.length) throw new UserFacingError("Choose the original document to resume this upload.");
      } else tx.set(record, {fileName: validated.fileName, contentType: validated.contentType, size: bytes.length, sha256, uploadedBy: owner, uploadedAt: serverTimestamp(), state: "pending"});
    });
    const object = ref(storage, path);
    const matches = async () => { const existing = await getMetadata(object); return existing.customMetadata?.uploadedBy === owner && existing.customMetadata?.sha256 === sha256 && existing.size === bytes.length && existing.contentType === validated.contentType; };
    {
      try { await uploadBytes(object, bytes, {contentType: validated.contentType, customMetadata: {uploadedBy: owner, sha256, documentId: id}}); }
      catch (uploadError) { if (!await matches().catch(() => false)) throw uploadError; }
      await runTransaction(db, async tx => {
        const previous = (await tx.get(record)).data();
        if (!previous || previous.uploadedBy !== owner || previous.sha256 !== sha256) throw new UserFacingError("Upload details changed. Reload to retry.");
        if (previous.state !== "ready") tx.update(record, {state: "ready"});
      });
    } // The reserved pending record is retained for recovery.
  };
  const ready = async (id: string) => {
    documentPath(id);
    const item = (await getDoc(doc(db, root, id))).data();
    if (!item || item.state !== "ready") throw new UserFacingError("Document is not ready. Resume its upload first.");
    const metadata = await getMetadata(ref(storage, documentPath(id)));
    if (metadata.customMetadata?.sha256 !== item.sha256 || metadata.customMetadata?.uploadedBy !== item.uploadedBy || metadata.size !== item.size) throw new UserFacingError("Document content does not match its retained record.");
    return item as Omit<MaintenanceDocument, "id">;
  };
  return {list, upload, ready};
}
