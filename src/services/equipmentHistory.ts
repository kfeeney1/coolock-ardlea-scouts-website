import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";
import type { EquipmentItem } from "./equipment";
import type { EquipmentHistoryType } from "./equipmentHistoryLogic";
import { availableStockForMovement, validateStockMovement } from "./equipmentHistoryLogic";

export type EquipmentHistoryEntry = {
  id: string;
  itemId: string;
  itemName: string;
  type: EquipmentHistoryType;
  quantity: number;
  section: string;
  fromLocation: string;
  toLocation: string;
  details: string;
  sourceId: string;
  linkedItemId: string;
  createdBy: string;
  createdAt: Date | null;
};

export type EquipmentHistoryWrite = Omit<EquipmentHistoryEntry, "id" | "createdBy" | "createdAt">;

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to manage equipment history.");
  return uid;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function mapEntry(id: string, data: Record<string, unknown>): EquipmentHistoryEntry | null {
  const type = data.type as EquipmentHistoryType;
  if (!["item-created", "item-updated", "item-archived", "item-restored", "equipment-checked-out", "equipment-returned", "incident-reported", "incident-investigating", "incident-resolved", "stock-moved", "stock-moved-out", "stock-moved-in"].includes(String(type))) return null;
  if (typeof data.itemId !== "string" || typeof data.itemName !== "string") return null;
  return {
    id,
    itemId: data.itemId,
    itemName: data.itemName,
    type,
    quantity: integer(data.quantity),
    section: text(data.section),
    fromLocation: text(data.fromLocation),
    toLocation: text(data.toLocation),
    details: text(data.details),
    sourceId: text(data.sourceId),
    linkedItemId: text(data.linkedItemId),
    createdBy: text(data.createdBy),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null
  };
}

export async function loadEquipmentHistory(itemId: string): Promise<EquipmentHistoryEntry[]> {
  const snapshot = await getDocs(query(collection(db, "equipmentHistory"), where("itemId", "==", itemId)));
  return snapshot.docs
    .map((entry) => mapEntry(entry.id, entry.data()))
    .filter((entry): entry is EquipmentHistoryEntry => entry !== null)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export async function recordEquipmentHistory(entry: EquipmentHistoryWrite): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await addDoc(collection(db, "equipmentHistory"), {
      ...entry,
      createdBy: uid,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Unable to record equipment history:", error);
  }
}

export async function moveEquipmentStock(item: EquipmentItem, quantity: number, destination: string): Promise<string | null> {
  const uid = currentUid();
  const safeDestination = destination.trim();
  const validation = validateStockMovement(item, quantity, safeDestination);
  if (validation) throw new Error(validation);

  const sourceRef = doc(db, "equipmentItems", item.id);
  const movementId = doc(collection(db, "equipmentHistory")).id;
  let destinationItemId: string | null = null;
  let auditName = item.name;
  let auditFrom = item.location;

  await runTransaction(db, async (transaction) => {
    const sourceSnapshot = await transaction.get(sourceRef);
    if (!sourceSnapshot.exists()) throw new Error("That equipment item no longer exists.");
    const data = sourceSnapshot.data();
    const totalQuantity = integer(data.totalQuantity);
    const checkedOutQuantity = integer(data.checkedOutQuantity);
    const unavailableQuantity = integer(data.unavailableQuantity);
    const currentLocation = text(data.location);
    const archived = data.archived === true;
    const liveValidation = validateStockMovement({ totalQuantity, checkedOutQuantity, unavailableQuantity, archived, location: currentLocation }, quantity, safeDestination);
    if (liveValidation) throw new Error(liveValidation);

    const itemName = text(data.name) || item.name;
    auditName = itemName;
    auditFrom = currentLocation;
    const available = availableStockForMovement({ totalQuantity, checkedOutQuantity, unavailableQuantity });
    const fullRelocation = quantity === totalQuantity && available === totalQuantity;

    if (fullRelocation) {
      transaction.update(sourceRef, {
        location: safeDestination,
        updatedBy: uid,
        updatedAt: serverTimestamp()
      });
      const historyRef = doc(collection(db, "equipmentHistory"));
      transaction.set(historyRef, {
        itemId: item.id,
        itemName,
        type: "stock-moved",
        quantity,
        section: "Group",
        fromLocation: currentLocation,
        toLocation: safeDestination,
        details: `Moved ${quantity} × ${itemName} from ${currentLocation} to ${safeDestination}.`,
        sourceId: movementId,
        linkedItemId: "",
        createdBy: uid,
        createdAt: serverTimestamp()
      });
      return;
    }

    const destinationRef = doc(collection(db, "equipmentItems"));
    destinationItemId = destinationRef.id;
    transaction.update(sourceRef, {
      totalQuantity: totalQuantity - quantity,
      updatedBy: uid,
      updatedAt: serverTimestamp()
    });
    transaction.set(destinationRef, {
      name: itemName,
      category: text(data.category),
      trackingMode: data.trackingMode === "individual" ? "individual" : "quantity",
      totalQuantity: quantity,
      checkedOutQuantity: 0,
      unavailableQuantity: 0,
      location: safeDestination,
      condition: text(data.condition) || "good",
      notes: text(data.notes),
      replacementValue: typeof data.replacementValue === "number" ? data.replacementValue : null,
      archived: false,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedBy: uid,
      updatedAt: serverTimestamp()
    });

    const sourceHistoryRef = doc(collection(db, "equipmentHistory"));
    const destinationHistoryRef = doc(collection(db, "equipmentHistory"));
    transaction.set(sourceHistoryRef, {
      itemId: item.id,
      itemName,
      type: "stock-moved-out",
      quantity,
      section: "Group",
      fromLocation: currentLocation,
      toLocation: safeDestination,
      details: `Moved ${quantity} × ${itemName} from ${currentLocation} to ${safeDestination}, creating a separate stock record at the destination.`,
      sourceId: movementId,
      linkedItemId: destinationRef.id,
      createdBy: uid,
      createdAt: serverTimestamp()
    });
    transaction.set(destinationHistoryRef, {
      itemId: destinationRef.id,
      itemName,
      type: "stock-moved-in",
      quantity,
      section: "Group",
      fromLocation: currentLocation,
      toLocation: safeDestination,
      details: `Received ${quantity} × ${itemName} from ${currentLocation}.`,
      sourceId: movementId,
      linkedItemId: item.id,
      createdBy: uid,
      createdAt: serverTimestamp()
    });
  });

  await recordAuditEvent({
    category: "equipment",
    action: "stock-moved",
    targetId: item.id,
    targetLabel: auditName,
    description: `Moved ${quantity} × ${auditName} from ${auditFrom} to ${safeDestination}${destinationItemId ? " into a separate destination stock record" : ""}.`,
    section: "Group"
  });
  return destinationItemId;
}
