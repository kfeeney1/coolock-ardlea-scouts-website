import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
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
  const snapshot = await getDocs(collection(db, "financeTransactions"));
  return snapshot.docs
    .map((item) => mapTransaction(item.id, item.data()))
    .filter((item): item is FinanceTransaction => item !== null)
    .filter((item) => !section || item.section === section)
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.id.localeCompare(a.id));
}

export async function createFinanceTransaction(input: FinanceTransactionInput): Promise<string> {
  const uid = currentUid();
  const validated = validateFinanceTransactionInput(input);
  const result = await addDoc(collection(db, "financeTransactions"), {
    ...validated,
    createdBy: uid,
    createdAt: serverTimestamp()
  });
  return result.id;
}

export async function reverseFinanceTransaction(original: FinanceTransaction, transactionDate: string, description?: string): Promise<string> {
  return createFinanceTransaction(createReversalInput(original, transactionDate, description));
}

export async function loadFinanceBalanceCents(section: string): Promise<number> {
  return calculateLedgerBalanceCents(await loadFinanceTransactions(section));
}
