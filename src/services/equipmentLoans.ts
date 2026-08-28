import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";
import type { EquipmentItem } from "./equipment";
import {
  availableEquipmentQuantity,
  loanIsComplete,
  outstandingLoanQuantity
} from "./equipmentLoanLogic";
import type { EquipmentLoanLine } from "./equipmentLoanLogic";

export type EquipmentLoan = {
  id: string;
  section: string;
  expectedReturnDate: string;
  notes: string;
  status: "open" | "returned";
  lines: EquipmentLoanLine[];
  createdBy: string;
  createdAt: Date | null;
  updatedBy: string;
  updatedAt: Date | null;
};

export type CheckoutRequestLine = {
  itemId: string;
  quantity: number;
};

export type CheckoutRequest = {
  section: string;
  expectedReturnDate: string;
  notes: string;
  lines: CheckoutRequestLine[];
};

export type ReturnRequest = {
  loanId: string;
  quantities: Record<string, number>;
};

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to use Equipment & Stores.");
  return uid;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function mapLoanLine(value: unknown): EquipmentLoanLine | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.itemId !== "string" || typeof data.itemName !== "string") return null;
  if (typeof data.quantity !== "number" || !Number.isInteger(data.quantity) || data.quantity <= 0) return null;
  const returnedQuantity = integer(data.returnedQuantity);
  const incidentQuantity = integer(data.incidentQuantity);
  if (returnedQuantity + incidentQuantity > data.quantity) return null;
  return {
    itemId: data.itemId,
    itemName: data.itemName,
    quantity: data.quantity,
    returnedQuantity,
    incidentQuantity
  };
}

function mapLoan(id: string, data: Record<string, unknown>): EquipmentLoan | null {
  if (typeof data.section !== "string" || typeof data.expectedReturnDate !== "string" || typeof data.notes !== "string") return null;
  if (data.status !== "open" && data.status !== "returned") return null;
  if (!Array.isArray(data.lines)) return null;
  const lines = data.lines.map(mapLoanLine).filter((line): line is EquipmentLoanLine => line !== null);
  if (lines.length !== data.lines.length || lines.length === 0) return null;
  return {
    id,
    section: data.section,
    expectedReturnDate: data.expectedReturnDate,
    notes: data.notes,
    status: data.status,
    lines,
    createdBy: text(data.createdBy),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedBy: text(data.updatedBy),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null
  };
}

export async function loadEquipmentLoans(): Promise<EquipmentLoan[]> {
  const snapshot = await getDocs(collection(db, "equipmentLoans"));
  return snapshot.docs
    .map((item) => mapLoan(item.id, item.data()))
    .filter((item): item is EquipmentLoan => item !== null)
    .sort((a, b) => a.status.localeCompare(b.status) || a.expectedReturnDate.localeCompare(b.expectedReturnDate));
}

export async function checkoutEquipment(request: CheckoutRequest): Promise<string> {
  const uid = currentUid();
  const section = request.section.trim();
  const lines = request.lines.filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);
  if (!section) throw new Error("Choose the section taking the equipment.");
  if (!request.expectedReturnDate) throw new Error("Choose an expected return date.");
  if (lines.length === 0) throw new Error("Select at least one equipment item.");

  const loanRef = doc(collection(db, "equipmentLoans"));
  let auditSummary = "";

  await runTransaction(db, async (transaction) => {
    const refs = lines.map((line) => doc(db, "equipmentItems", line.itemId));
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const loanLines: EquipmentLoanLine[] = [];

    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index];
      const requested = lines[index];
      if (!snapshot.exists()) throw new Error("One of the selected equipment items no longer exists.");
      const data = snapshot.data();
      const item: Pick<EquipmentItem, "name" | "totalQuantity" | "checkedOutQuantity" | "unavailableQuantity" | "archived"> = {
        name: typeof data.name === "string" ? data.name : "Equipment",
        totalQuantity: integer(data.totalQuantity),
        checkedOutQuantity: integer(data.checkedOutQuantity),
        unavailableQuantity: integer(data.unavailableQuantity),
        archived: data.archived === true
      };
      if (item.archived) throw new Error(`${item.name} is archived and cannot be checked out.`);
      const available = availableEquipmentQuantity(item as EquipmentItem);
      if (requested.quantity > available) throw new Error(`Only ${available} × ${item.name} ${available === 1 ? "is" : "are"} available.`);

      loanLines.push({ itemId: requested.itemId, itemName: item.name, quantity: requested.quantity, returnedQuantity: 0, incidentQuantity: 0 });
      transaction.update(refs[index], {
        checkedOutQuantity: item.checkedOutQuantity + requested.quantity,
        updatedBy: uid,
        updatedAt: serverTimestamp()
      });
    }

    auditSummary = loanLines.map((line) => `${line.quantity} × ${line.itemName}`).join(", ");
    transaction.set(loanRef, {
      section,
      expectedReturnDate: request.expectedReturnDate,
      notes: request.notes.trim(),
      status: "open",
      lines: loanLines,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedBy: uid,
      updatedAt: serverTimestamp()
    });
  });

  await recordAuditEvent({
    category: "equipment",
    action: "equipment-checked-out",
    targetId: loanRef.id,
    targetLabel: section,
    description: `Checked out ${auditSummary} to ${section}; expected back ${request.expectedReturnDate}.`,
    section
  });
  return loanRef.id;
}

export async function returnEquipment(request: ReturnRequest): Promise<void> {
  const uid = currentUid();
  const loanRef = doc(db, "equipmentLoans", request.loanId);
  let auditSection = "Group";
  let auditSummary = "";

  await runTransaction(db, async (transaction) => {
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error("That equipment checkout no longer exists.");
    const loan = mapLoan(loanSnapshot.id, loanSnapshot.data());
    if (!loan || loan.status !== "open") throw new Error("That equipment checkout is already closed.");

    const selected = loan.lines
      .map((line) => ({ line, quantity: request.quantities[line.itemId] ?? 0 }))
      .filter(({ quantity }) => Number.isInteger(quantity) && quantity > 0);
    if (selected.length === 0) throw new Error("Enter at least one quantity to return.");
    for (const { line, quantity } of selected) {
      if (quantity > outstandingLoanQuantity(line)) throw new Error(`You cannot return more ${line.itemName} than remain checked out.`);
    }

    const refs = selected.map(({ line }) => doc(db, "equipmentItems", line.itemId));
    const itemSnapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const returnedByItem = new Map(selected.map(({ line, quantity }) => [line.itemId, quantity]));
    const nextLines = loan.lines.map((line) => ({
      ...line,
      returnedQuantity: line.returnedQuantity + (returnedByItem.get(line.itemId) ?? 0)
    }));

    selected.forEach(({ line, quantity }, index) => {
      const snapshot = itemSnapshots[index];
      if (!snapshot.exists()) throw new Error(`${line.itemName} no longer exists in the inventory.`);
      const checkedOutQuantity = integer(snapshot.data().checkedOutQuantity);
      if (quantity > checkedOutQuantity) throw new Error(`The checked-out stock count for ${line.itemName} is inconsistent. Ask the Quartermaster to review it.`);
      transaction.update(refs[index], {
        checkedOutQuantity: checkedOutQuantity - quantity,
        updatedBy: uid,
        updatedAt: serverTimestamp()
      });
    });

    transaction.update(loanRef, {
      lines: nextLines,
      status: loanIsComplete(nextLines) ? "returned" : "open",
      updatedBy: uid,
      updatedAt: serverTimestamp()
    });

    auditSection = loan.section;
    auditSummary = selected.map(({ line, quantity }) => `${quantity} × ${line.itemName}`).join(", ");
  });

  await recordAuditEvent({
    category: "equipment",
    action: "equipment-returned",
    targetId: request.loanId,
    targetLabel: auditSection,
    description: `Returned ${auditSummary} from ${auditSection}.`,
    section: auditSection
  });
}
