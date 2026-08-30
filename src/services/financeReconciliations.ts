import { addDoc, collection, getDocs, query, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";
import {
  createFinanceReconciliationWrite,
  type FinanceReconciliationRecord,
  type FinanceTransaction
} from "./financeLedgerLogic";

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to reconcile section finance.");
  return uid;
}

function mapReconciliation(id: string, data: Record<string, unknown>): FinanceReconciliationRecord | null {
  if (typeof data.section !== "string") return null;
  if (typeof data.expectedBalanceCents !== "number" || !Number.isInteger(data.expectedBalanceCents)) return null;
  if (typeof data.countedBalanceCents !== "number" || !Number.isInteger(data.countedBalanceCents)) return null;
  if (typeof data.differenceCents !== "number" || !Number.isInteger(data.differenceCents)) return null;
  if (typeof data.note !== "string" || typeof data.reconciledBy !== "string") return null;
  return {
    id,
    section: data.section,
    expectedBalanceCents: data.expectedBalanceCents,
    countedBalanceCents: data.countedBalanceCents,
    differenceCents: data.differenceCents,
    note: data.note,
    reconciledBy: data.reconciledBy,
    reconciledAt: data.reconciledAt instanceof Timestamp ? data.reconciledAt.toDate() : null
  };
}

export async function loadFinanceReconciliations(section: string): Promise<FinanceReconciliationRecord[]> {
  const snapshot = await getDocs(query(collection(db, "financeReconciliations"), where("section", "==", section)));
  return snapshot.docs
    .map((item) => mapReconciliation(item.id, item.data()))
    .filter((item): item is FinanceReconciliationRecord => item !== null)
    .sort((a, b) => (b.reconciledAt?.getTime() ?? 0) - (a.reconciledAt?.getTime() ?? 0) || b.id.localeCompare(a.id));
}

export async function createFinanceReconciliation(
  section: string,
  transactions: FinanceTransaction[],
  countedBalanceCents: number,
  note: string
): Promise<string> {
  const uid = currentUid();
  const write = createFinanceReconciliationWrite(section, transactions, countedBalanceCents, note);
  const result = await addDoc(collection(db, "financeReconciliations"), {
    ...write,
    reconciledBy: uid,
    reconciledAt: serverTimestamp()
  });
  void recordAuditEvent({
    category: "finance",
    action: "cash-reconciled",
    targetId: result.id,
    targetLabel: `${write.section} cash reconciliation`,
    description: `Expected ${write.expectedBalanceCents} cents, counted ${write.countedBalanceCents} cents, difference ${write.differenceCents} cents`,
    section: write.section
  });
  return result.id;
}
