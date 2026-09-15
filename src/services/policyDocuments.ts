import { deleteObject, getBlob, getMetadata, listAll, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "../firebase";
import { recordAuditEvent } from "./auditLog";

export const POLICY_AUDIENCES = ["public", "authenticated", "parent", "leader", "admin"] as const;
export type PolicyAudience = typeof POLICY_AUDIENCES[number];

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

async function loadAudience(audience: PolicyAudience): Promise<PolicyDocument[]> {
  const root = ref(storage, rootFor(audience));
  const documents: PolicyDocument[] = [];
  const documentFolders = await listAll(root);
  try {
    for (const documentFolder of documentFolders.prefixes) {
      const versionFolders = await listAll(documentFolder);
      for (const versionFolder of versionFolders.prefixes) {
        const files = await listAll(versionFolder);
        for (const item of files.items) {
          const metadata = await getMetadata(item);
          const custom = metadata.customMetadata ?? {};
          if (custom.ownerType !== "policy-document" || custom.audience !== audience || custom.state !== "current") continue;
          const contentType = metadata.contentType || "application/pdf";
          documents.push({
            documentId: custom.documentId || documentFolder.name,
            versionId: custom.versionId || versionFolder.name,
            title: custom.title || custom.originalFileName || item.name,
            description: custom.description || "",
            category: custom.category || "Policy",
            audience,
            effectiveDate: custom.effectiveDate || "",
            sourceOwner: custom.sourceOwner || "",
            storagePath: item.fullPath,
            fileName: custom.originalFileName || item.name,
            contentType,
            size: metadata.size,
            publishedBy: custom.publishedBy || "",
            publishedAt: custom.publishedAt || "",
            viewUrl: await objectUrl(item.fullPath, contentType),
          });
        }
      }
    }
    return documents;
  } catch (error) {
    revokePolicyDocumentUrls(documents);
    throw error;
  }
}

export async function loadPolicyDocuments(): Promise<PolicyDocument[]> {
  const audiences: PolicyAudience[] = auth.currentUser
    ? ["public", "authenticated", "parent", "leader", "admin"]
    : ["public"];
  const settled = await Promise.allSettled(audiences.map(loadAudience));
  const documents = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return documents.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

export async function publishPolicyDocument(input: PublishPolicyInput): Promise<void> {
  validate(input);
  const uid = currentUid();
  const documentId = safeSegment(input.documentId || input.title, crypto.randomUUID());
  const versionId = safeSegment(input.effectiveDate || new Date().toISOString().slice(0, 10), crypto.randomUUID());
  const fileName = safeSegment(input.file.name, "policy.pdf");
  const path = `${rootFor(input.audience)}/${documentId}/${versionId}/${fileName}`;
  const publishedAt = new Date().toISOString();

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
      publishedAt,
      originalFileName: input.file.name,
    },
  });

  void recordAuditEvent({ category: "system", action: "policy-published", targetId: documentId, targetLabel: input.title.trim(), description: `Published policy document for ${input.audience} audience.`, section: "group" });
}

export async function withdrawPolicyDocument(document: PolicyDocument): Promise<void> {
  currentUid();
  await deleteObject(ref(storage, document.storagePath));
  void recordAuditEvent({ category: "system", action: "policy-withdrawn", targetId: document.documentId, targetLabel: document.title, description: `Withdrew current policy document ${document.versionId}.`, section: "group" });
}
