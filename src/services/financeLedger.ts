import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";
import { validateFinanceTransferInput, type FinanceTransferInput } from "./financeTransferLogic";
import {
  calculateLedgerBalanceCents,
  createReversalInput,
  validateFinanceTransactionInput,
  type FinanceTransaction,
  type FinanceTransactionInput,
  type FinanceTransactionType
} from "./financeLedgerLogic";

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to manage section finance.");
  return uid;
}

function mapTransaction(id: string, data: Record<string, unknown>): FinanceTransaction | null {
  const type = data.type as FinanceTransactionType;
  if (!["opening-float", "income", "expense", "transfer-in", "transfer-out", "adjustment"].includes(String(type))) return null;
  if (typeof data.section !== "string" || typeof data.amountCents !== "number" || !Number.isInteger(data.amountCents)) return null;
  if (typeof data.category !== "string" || typeof data.description !== "string" || typeof data.transactionDate !== "string") return null;
  return {
    id,
    section: data.section,
    type,
    amountCents: data.amountCents,
    category: data.category,
    description: data.description,
    transactionDate: data.transactionDate,
    sourceTransactionId: typeof data.sourceTransactionId === "string" ? data.sourceTransactionId : "",
    reversalOfTransactionId: typeof data.reversalOfTransactionId === "string" ? data.reversalOfTransactionId : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : ""
  };
}

export async function loadFinanceTransactions(section?: string): Promise<FinanceTransaction[]> {
  const financeCollection = collection(db, "financeTransactions");
  const source = section ? query(financeCollection, where("section", "==", section)) : financeCollection;
  const snapshot = await getDocs(source);
  return snapshot.docs
    .map((item) => mapTransaction(item.id, item.data()))
    .filter((item): item is FinanceTransaction => item !== null)
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.id.localeCompare(a.id));
}

export async function createFinanceTransaction(input: FinanceTransactionInput): Promise<string> {
  const uid = currentUid();
  const validated = validateFinanceTransactionInput(input);
  if (["adjustment", "transfer-in", "transfer-out"].includes(validated.type)) {
    throw new Error("Use the dedicated finance workflow for corrections and transfers.");
  }
  const result = await addDoc(collection(db, "financeTransactions"), {
    ...validated,
    createdBy: uid,
    createdAt: serverTimestamp()
  });
  void recordAuditEvent({
    category: "finance",
    action: "transaction-created",
    targetId: result.id,
    targetLabel: validated.description,
    description: `${validated.type} recorded for ${validated.section}`,
    section: validated.section
  });
  return result.id;
}

export async function createFinanceTransfer(input: FinanceTransferInput): Promise<string> {
  const uid = currentUid();
  const validated = validateFinanceTransferInput(input);
  const transferId = doc(collection(db, "financeTransactions")).id;
  const batch = writeBatch(db);
  const shared = {
    amountCents: validated.amountCents,
    category: "Bank / transfer",
    transactionDate: validated.transactionDate,
    sourceTransactionId: transferId,
    reversalOfTransactionId: "",
    createdBy: uid,
    createdAt: serverTimestamp()
  };

  batch.set(doc(db, "financeTransactions", `${transferId}-out`), {
    ...shared,
    section: validated.fromSection,
    type: "transfer-out",
    description: `Transfer to ${validated.toSection}: ${validated.description}`
  });
  batch.set(doc(db, "financeTransactions", `${transferId}-in`), {
    ...shared,
    section: validated.toSection,
    type: "transfer-in",
    description: `Transfer from ${validated.fromSection}: ${validated.description}`
  });
  await batch.commit();

  void recordAuditEvent({
    category: "finance",
    action: "transfer-created",
    targetId: transferId,
    targetLabel: validated.description,
    description: `Transferred ${validated.amountCents} cents from ${validated.fromSection} to ${validated.toSection}`,
    section: validated.fromSection
  });
  return transferId;
}

export async function reverseFinanceTransaction(original: FinanceTransaction, transactionDate: string, description?: string): Promise<string> {
  if (original.type === "adjustment") throw new Error("An adjustment cannot itself be reversed from this workflow.");
  const uid = currentUid();
  const reversal = createReversalInput(original, transactionDate, description);
  const reversalId = `reversal-${original.id}`;
  await setDoc(doc(db, "financeTransactions", reversalId), {
    ...reversal,
    createdBy: uid,
    createdAt: serverTimestamp()
  });
  void recordAuditEvent({
    category: "finance",
    action: "transaction-corrected",
    targetId: original.id,
    targetLabel: original.description,
    description: `Created linked correction ${reversalId}`,
    section: original.section
  });
  return reversalId;
}

export async function loadFinanceBalanceCents(section: string): Promise<number> {
  return calculateLedgerBalanceCents(await loadFinanceTransactions(section));
}
