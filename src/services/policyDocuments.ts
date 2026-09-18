import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { deleteObject, getBlob, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../firebase";
import { recordAuditEvent } from "./auditLog";

export const POLICY_AUDIENCES = ["public", "authenticated", "parent", "leader", "admin"] as const;
export type PolicyAudience = typeof POLICY_AUDIENCES[number];

export interface PolicyVersionSummary {
  versionId: string;
  effectiveDate: string;
  storagePath: string;
  fileName: string;
  publishedBy: string;
  publishedAt: string;
}

export interface PolicyDocument {
  documentId: string;
  versionId: string;
  title: string;
  description: string;
  category: string;
  audience: PolicyAudience;
  effectiveDate: string;
  sourceOwner: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  size: number;
  publishedBy: string;
  publishedAt: string;
  state: "current";
  viewUrl: string;
}

export interface PublishPolicyInput {
  documentId?: string;
  title: string;
  description: string;
  category: string;
  audience: PolicyAudience;
  effectiveDate: string;
  sourceOwner: string;
  file: File;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf"]);
const POLICY_COLLECTION = "policyDocuments";

function safeSegment(value: string, fallback: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return cleaned || fallback;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to publish policy documents.");
  return uid;
}

function validate(input: PublishPolicyInput): void {
  if (!input.title.trim()) throw new Error("A document title is required.");
  if (!input.category.trim()) throw new Error("A category is required.");
  if (!POLICY_AUDIENCES.includes(input.audience)) throw new Error("Choose a valid audience.");
  if (!input.file || input.file.size <= 0) throw new Error("Choose a non-empty PDF file.");
  if (input.file.size > MAX_BYTES) throw new Error("Policy documents must be 10 MB or smaller.");
  if (!ALLOWED_TYPES.has(input.file.type)) throw new Error("Policy documents must be PDF files.");
}

function rootFor(audience: PolicyAudience): string {
  return `attachments/policy-documents/current/${audience}`;
}

async function objectUrl(path: string, contentType: string): Promise<string> {
  const blob = await getBlob(ref(storage, path));
  const typed = blob.type || !contentType ? blob : blob.slice(0, blob.size, contentType);
  return URL.createObjectURL(typed);
}

export function revokePolicyDocumentUrls(documents: PolicyDocument[]): void {
  for (const document of documents) URL.revokeObjectURL(document.viewUrl);
}

function audienceQueries(): PolicyAudience[] {
  return auth.currentUser ? ["public", "authenticated", "parent", "leader", "admin"] : ["public"];
}

export async function loadPolicyDocuments(): Promise<PolicyDocument[]> {
  const snapshots = await Promise.allSettled(audienceQueries().map((audience) =>
    getDocs(query(collection(db, POLICY_COLLECTION), where("state", "==", "current"), where("audience", "==", audience))),
  ));
  const metadata = snapshots.flatMap((result) => result.status === "fulfilled" ? result.value.docs.map((item) => item.data()) : []);
  const documents: PolicyDocument[] = [];
  try {
    for (const item of metadata) {
      if (item.state !== "current" || !POLICY_AUDIENCES.includes(item.audience)) continue;
      const viewUrl = await objectUrl(item.storagePath, item.contentType || "application/pdf");
      documents.push({
        documentId: item.documentId,
        versionId: item.versionId,
        title: item.title,
        description: item.description || "",
        category: item.category,
        audience: item.audience,
        effectiveDate: item.effectiveDate || "",
        sourceOwner: item.sourceOwner || "",
        storagePath: item.storagePath,
        fileName: item.fileName,
        contentType: item.contentType || "application/pdf",
        size: item.size,
        publishedBy: item.publishedBy,
        publishedAt: item.publishedAt?.toDate?.().toISOString?.() || "",
        state: "current",
        viewUrl,
      });
    }
    return documents.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  } catch (error) {
    revokePolicyDocumentUrls(documents);
    throw error;
  }
}

export async function publishPolicyDocument(input: PublishPolicyInput): Promise<void> {
  validate(input);
  const uid = currentUid();
  const documentId = safeSegment(input.documentId || input.title, crypto.randomUUID());
  const versionId = safeSegment(input.effectiveDate || new Date().toISOString().slice(0, 10), crypto.randomUUID());
  const fileName = safeSegment(input.file.name, "policy.pdf");
  const path = `${rootFor(input.audience)}/${documentId}/${versionId}/${fileName}`;
  const metadataRef = doc(db, POLICY_COLLECTION, documentId);

  await uploadBytes(ref(storage, path), input.file, {
    contentType: input.file.type,
    customMetadata: {
      ownerType: "policy-document",
      documentId,
      versionId,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category.trim(),
      audience: input.audience,
      effectiveDate: input.effectiveDate,
      sourceOwner: input.sourceOwner.trim(),
      state: "current",
      publishedBy: uid,
      originalFileName: input.file.name,
    },
  });

  try {
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(metadataRef);
      const prior = existing.exists() ? existing.data() : null;
      const previousVersions: PolicyVersionSummary[] = Array.isArray(prior?.previousVersions) ? prior.previousVersions : [];
      if (prior?.state === "current" && prior.versionId && prior.storagePath) {
        previousVersions.push({
          versionId: prior.versionId,
          effectiveDate: prior.effectiveDate || "",
          storagePath: prior.storagePath,
          fileName: prior.fileName || "",
          publishedBy: prior.publishedBy || "",
          publishedAt: prior.publishedAt?.toDate?.().toISOString?.() || "",
        });
      }
      transaction.set(metadataRef, {
        documentId,
        versionId,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category.trim(),
        audience: input.audience,
        effectiveDate: input.effectiveDate,
        sourceOwner: input.sourceOwner.trim(),
        storagePath: path,
        fileName: input.file.name,
        contentType: input.file.type,
        size: input.file.size,
        publishedBy: uid,
        publishedAt: serverTimestamp(),
        state: "current",
        previousVersions,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    try { await deleteObject(ref(storage, path)); } catch (cleanupError) { console.error("Unable to clean up unpublished policy upload:", cleanupError); }
    throw error;
  }

  void recordAuditEvent({ category: "system", action: "policy-published", targetId: documentId, targetLabel: input.title.trim(), description: `Published policy document for ${input.audience} audience.`, section: "group" });
}

export async function withdrawPolicyDocument(document: PolicyDocument): Promise<void> {
  const uid = currentUid();
  const metadataRef = doc(db, POLICY_COLLECTION, document.documentId);
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(metadataRef);
    if (!current.exists() || current.data().versionId !== document.versionId || current.data().state !== "current") {
      throw new Error("This policy version is no longer current. Refresh the catalogue and try again.");
    }
    transaction.update(metadataRef, { state: "withdrawn", withdrawnBy: uid, withdrawnAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp() });
  });
  void recordAuditEvent({ category: "system", action: "policy-withdrawn", targetId: document.documentId, targetLabel: document.title, description: `Withdrew current policy document ${document.versionId}.`, section: "group" });
}
