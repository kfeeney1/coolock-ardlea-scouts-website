import { createHash } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { requireMaintenance } from "./request.js";
const types = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const root = "maintenance/group/documents";
export function validateUpload(input) {
  if (typeof input?.id !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(input.id)) throw new HttpsError("invalid-argument", "Invalid upload reference.");
  if (typeof input.fileName !== "string" || !input.fileName.trim() || input.fileName.length > 240 || !types.includes(input.contentType)) throw new HttpsError("invalid-argument", "Choose a named PDF, JPEG, PNG or WebP document.");
  if (typeof input.base64 !== "string" || input.base64.length > 14 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) throw new HttpsError("invalid-argument", "Invalid document content.");
  const bytes = Buffer.from(input.base64, "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024 || bytes.toString("base64") !== input.base64) throw new HttpsError("invalid-argument", "Documents must be between 1 byte and 10 MB.");
  const signature = input.contentType === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" : input.contentType === "image/png" ? bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" : input.contentType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!signature) throw new HttpsError("invalid-argument", "Document content does not match its file type.");
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}
export async function handleDocuments(db, bucket, request) {
  const uid = await requireMaintenance(db, request);
  const input = request.data || {};
  if (input.action === "list") {
    let query = db.collection(root).orderBy("uploadedAt", "desc").limit(50);
    if (input.after) {
      if (typeof input.after !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(input.after)) throw new HttpsError("invalid-argument", "Invalid page reference.");
      const cursor = await db.doc(`${root}/${input.after}`).get();
      if (!cursor.exists) throw new HttpsError("not-found", "Refresh the documents list.");
      query = query.startAfter(cursor);
    }
    const docs = await query.get();
    return { documents: docs.docs.map(doc => ({ id: doc.id, ...doc.data() })), next: docs.size === 50 ? docs.docs.at(-1).id : "" };
  }
  if (input.action === "upload") {
    const { bytes, sha256 } = validateUpload(input);
    const ref = db.doc(`${root}/${input.id}`);
    const metadata = { fileName: input.fileName.trim(), contentType: input.contentType, size: bytes.length, sha256, uploadedBy: uid, uploadedAt: Date.now(), state: "pending" };
    await db.runTransaction(async tx => {
      const existing = (await tx.get(ref)).data();
      if (existing && (existing.uploadedBy !== uid || existing.sha256 !== sha256 || existing.fileName !== metadata.fileName || existing.contentType !== metadata.contentType)) throw new HttpsError("already-exists", "This upload reference belongs to another document.");
      if (!existing) tx.create(ref, metadata);
    });
    const file = bucket.file(`maintenance-documents/${input.id}`);
    try { await file.save(bytes, { resumable: false, contentType: input.contentType, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { metadata: { sha256, uploadedBy: uid } } }); }
    catch (error) { if (Number(error.code) !== 412) throw new HttpsError("unavailable", "Upload did not finish. Retry the same document to resume."); }
    await ref.update({ state: "ready" });
    return { id: input.id };
  }
  if (input.action === "download") {
    if (typeof input.id !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(input.id)) throw new HttpsError("invalid-argument", "Invalid document reference.");
    const doc = (await db.doc(`${root}/${input.id}`).get()).data();
    if (!doc || doc.state !== "ready") throw new HttpsError("not-found", "Document is not ready. Retry its upload first.");
    const [bytes] = await bucket.file(`maintenance-documents/${input.id}`).download();
    return { fileName: doc.fileName, contentType: doc.contentType, base64: bytes.toString("base64") };
  }
  throw new HttpsError("invalid-argument", "Unknown document action.");
}
