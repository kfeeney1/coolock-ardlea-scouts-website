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
import { recordEquipmentHistory } from "./equipmentHistory";
import {
  availableEquipmentQuantity,
  loanIsComplete,
  outstandingLoanQuantity
} from "./equipmentLoanLogic";
import type { EquipmentLoanLine } from "./equipmentLoanLogic";
import { EQUIPMENT_RESERVATION_NOTE_PREFIX, isEquipmentReservationLoan } from "./equipmentProgrammeLogic";

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

export type ReservationRequest = {
  section: string;
  reservationDate: string;
  sourceId: string;
  sourceLabel: string;
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

async function allocateEquipment(request: CheckoutRequest, reservation = false): Promise<string> {
  const uid = currentUid();
  const section = request.section.trim();
  const lines = request.lines.filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);
  if (!section) throw new Error("Choose the section taking the equipment.");
  if (!request.expectedReturnDate) throw new Error(reservation ? "Choose the reservation date." : "Choose an expected return date.");
  if (lines.length === 0) throw new Error("Select at least one equipment item.");

  const loanRef = doc(collection(db, "equipmentLoans"));
  let auditSummary = "";
  const historyRows: Array<{ itemId: string; itemName: string; quantity: number; location: string }> = [];

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
      if (item.archived) throw new Error(`${item.name} is archived and cannot be ${reservation ? "reserved" : "checked out"}.`);
      const available = availableEquipmentQuantity(item as EquipmentItem);
      if (requested.quantity > available) {
        throw new Error(`Only ${available} × ${item.name} ${available === 1 ? "is" : "are"} available; another checkout or reservation may already hold the remaining stock.`);
      }

      loanLines.push({ itemId: requested.itemId, itemName: item.name, quantity: requested.quantity, returnedQuantity: 0, incidentQuantity: 0 });
      historyRows.push({ itemId: requested.itemId, itemName: item.name, quantity: requested.quantity, location: text(data.location) });
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

  if (!reservation) {
    await Promise.all(historyRows.map((row) => recordEquipmentHistory({
      itemId: row.itemId,
      itemName: row.itemName,
      type: "equipment-checked-out",
      quantity: row.quantity,
      section,
      fromLocation: row.location,
      toLocation: section,
      details: `Checked out ${row.quantity} × ${row.itemName} to ${section}; expected back ${request.expectedReturnDate}.`,
      sourceId: loanRef.id,
      linkedItemId: ""
    })));
  }
  await recordAuditEvent({
    category: "equipment",
    action: reservation ? "equipment-reserved" : "equipment-checked-out",
    targetId: loanRef.id,
    targetLabel: section,
    description: reservation
      ? `Reserved ${auditSummary} for ${section} on ${request.expectedReturnDate}.`
      : `Checked out ${auditSummary} to ${section}; expected back ${request.expectedReturnDate}.`,
    section
  });
  return loanRef.id;
}

export async function checkoutEquipment(request: CheckoutRequest): Promise<string> {
  return allocateEquipment(request, false);
}

export async function reserveEquipment(request: ReservationRequest): Promise<string> {
  const sourceId = request.sourceId.trim();
  if (!sourceId) throw new Error("A programme source is required before equipment can be reserved.");
  return allocateEquipment({
    section: request.section,
    expectedReturnDate: request.reservationDate,
    notes: `${EQUIPMENT_RESERVATION_NOTE_PREFIX} ${sourceId} · ${request.sourceLabel.trim()}`,
    lines: request.lines
  }, true);
}

export async function cancelEquipmentReservation(reservationId: string): Promise<void> {
  const uid = currentUid();
  const loanRef = doc(db, "equipmentLoans", reservationId);
  let auditSection = "Group";
  let auditSummary = "";

  await runTransaction(db, async (transaction) => {
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error("That equipment reservation no longer exists.");
    const loan = mapLoan(loanSnapshot.id, loanSnapshot.data());
    if (!loan || loan.status !== "open" || !isEquipmentReservationLoan(loan)) throw new Error("That equipment reservation is no longer active.");

    const outstanding = loan.lines
      .map((line) => ({ line, quantity: outstandingLoanQuantity(line) }))
      .filter(({ quantity }) => quantity > 0);
    const refs = outstanding.map(({ line }) => doc(db, "equipmentItems", line.itemId));
    const itemSnapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));

    outstanding.forEach(({ line, quantity }, index) => {
      const snapshot = itemSnapshots[index];
      if (!snapshot.exists()) throw new Error(`${line.itemName} no longer exists in the inventory.`);
      const checkedOutQuantity = integer(snapshot.data().checkedOutQuantity);
      if (quantity > checkedOutQuantity) throw new Error(`The allocated stock count for ${line.itemName} is inconsistent. Ask the Quartermaster to review it.`);
      transaction.update(refs[index], {
        checkedOutQuantity: checkedOutQuantity - quantity,
        updatedBy: uid,
        updatedAt: serverTimestamp()
      });
    });

    transaction.update(loanRef, {
      lines: loan.lines.map((line) => ({ ...line, returnedQuantity: line.returnedQuantity + outstandingLoanQuantity(line) })),
      status: "returned",
      updatedBy: uid,
      updatedAt: serverTimestamp()
    });
    auditSection = loan.section;
    auditSummary = outstanding.map(({ line, quantity }) => `${quantity} × ${line.itemName}`).join(", ");
  });

  await recordAuditEvent({
    category: "equipment",
    action: "equipment-reservation-cancelled",
    targetId: reservationId,
    targetLabel: auditSection,
    description: `Cancelled reservation for ${auditSummary || "equipment"} for ${auditSection}; stock was released.`,
    section: auditSection
  });
}

export async function convertEquipmentReservation(reservationId: string, expectedReturnDate: string, notes: string): Promise<string> {
  const uid = currentUid();
  if (!expectedReturnDate) throw new Error("Choose an expected return date.");
  const reservationRef = doc(db, "equipmentLoans", reservationId);
  const checkoutRef = doc(collection(db, "equipmentLoans"));
  let auditSection = "Group";
  let auditSummary = "";
  const historyRows: Array<{ itemId: string; itemName: string; quantity: number; location: string }> = [];

  await runTransaction(db, async (transaction) => {
    const reservationSnapshot = await transaction.get(reservationRef);
    if (!reservationSnapshot.exists()) throw new Error("That equipment reservation no longer exists.");
    const reservation = mapLoan(reservationSnapshot.id, reservationSnapshot.data());
    if (!reservation || reservation.status !== "open" || !isEquipmentReservationLoan(reservation)) throw new Error("That equipment reservation is no longer active.");

    const checkoutLines = reservation.lines
      .map((line) => ({ ...line, quantity: outstandingLoanQuantity(line), returnedQuantity: 0, incidentQuantity: 0 }))
      .filter((line) => line.quantity > 0);
    if (!checkoutLines.length) throw new Error("That reservation has no equipment left to check out.");

    const refs = checkoutLines.map((line) => doc(db, "equipmentItems", line.itemId));
    const itemSnapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    checkoutLines.forEach((line, index) => {
      const snapshot = itemSnapshots[index];
      if (!snapshot.exists()) throw new Error(`${line.itemName} no longer exists in the inventory.`);
      if (integer(snapshot.data().checkedOutQuantity) < line.quantity) throw new Error(`The reserved stock count for ${line.itemName} is inconsistent. Ask the Quartermaster to review it.`);
      historyRows.push({ itemId: line.itemId, itemName: line.itemName, quantity: line.quantity, location: text(snapshot.data().location) });
    });

    transaction.update(reservationRef, {
      lines: reservation.lines.map((line) => ({ ...line, returnedQuantity: line.returnedQuantity + outstandingLoanQuantity(line) })),
      status: "returned",
      updatedBy: uid,
      updatedAt: serverTimestamp()
    });
    transaction.set(checkoutRef, {
      section: reservation.section,
      expectedReturnDate,
      notes: notes.trim(),
      status: "open",
      lines: checkoutLines,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedBy: uid,
      updatedAt: serverTimestamp()
    });
    auditSection = reservation.section;
    auditSummary = checkoutLines.map((line) => `${line.quantity} × ${line.itemName}`).join(", ");
  });

  await Promise.all(historyRows.map((row) => recordEquipmentHistory({
    itemId: row.itemId,
    itemName: row.itemName,
    type: "equipment-checked-out",
    quantity: row.quantity,
    section: auditSection,
    fromLocation: row.location,
    toLocation: auditSection,
    details: `Checked out reserved ${row.quantity} × ${row.itemName} to ${auditSection}; expected back ${expectedReturnDate}.`,
    sourceId: checkoutRef.id,
    linkedItemId: ""
  })));
  await recordAuditEvent({
    category: "equipment",
    action: "equipment-reservation-checked-out",
    targetId: checkoutRef.id,
    targetLabel: auditSection,
    description: `Converted reservation ${reservationId} to checkout: ${auditSummary}; expected back ${expectedReturnDate}.`,
    section: auditSection
  });
  return checkoutRef.id;
}

export async function returnEquipment(request: ReturnRequest): Promise<void> {
  const uid = currentUid();
  const loanRef = doc(db, "equipmentLoans", request.loanId);
  let auditSection = "Group";
  let auditSummary = "";
  const historyRows: Array<{ itemId: string; itemName: string; quantity: number; location: string }> = [];

  await runTransaction(db, async (transaction) => {
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error("That equipment checkout no longer exists.");
    const loan = mapLoan(loanSnapshot.id, loanSnapshot.data());
    if (!loan || loan.status !== "open") throw new Error("That equipment checkout is already closed.");
    if (isEquipmentReservationLoan(loan)) throw new Error("Use the programme equipment reservation controls to cancel a reservation before checkout.");

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
      historyRows.push({ itemId: line.itemId, itemName: line.itemName, quantity, location: text(snapshot.data().location) });
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

  await Promise.all(historyRows.map((row) => recordEquipmentHistory({
    itemId: row.itemId,
    itemName: row.itemName,
    type: "equipment-returned",
    quantity: row.quantity,
    section: auditSection,
    fromLocation: auditSection,
    toLocation: row.location,
    details: `Returned ${row.quantity} × ${row.itemName} from ${auditSection}.`,
    sourceId: request.loanId,
    linkedItemId: ""
  })));
  await recordAuditEvent({
    category: "equipment",
    action: "equipment-returned",
    targetId: request.loanId,
    targetLabel: auditSection,
    description: `Returned ${auditSummary} from ${auditSection}.`,
    section: auditSection
  });
}
