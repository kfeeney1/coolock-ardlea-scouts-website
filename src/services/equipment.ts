import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";
import { recordEquipmentHistory } from "./equipmentHistory";
import { normaliseEquipmentLabel } from "./equipmentLogic";
import type { EquipmentCondition, EquipmentTrackingMode } from "./equipmentLogic";

export type EquipmentItem = {
  id: string;
  name: string;
  category: string;
  trackingMode: EquipmentTrackingMode;
  totalQuantity: number;
  checkedOutQuantity: number;
  unavailableQuantity: number;
  location: string;
  condition: EquipmentCondition;
  notes: string;
  replacementValue: number | null;
  archived: boolean;
  createdBy: string;
  updatedBy: string;
};

export type EquipmentOption = {
  id: string;
  name: string;
};

export type EquipmentItemInput = Omit<EquipmentItem, "id" | "createdBy" | "updatedBy" | "archived" | "checkedOutQuantity" | "unavailableQuantity">;

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to manage equipment.");
  return uid;
}

function mapItem(id: string, data: Record<string, unknown>): EquipmentItem | null {
  if (typeof data.name !== "string" || typeof data.category !== "string" || typeof data.location !== "string") return null;
  if (data.trackingMode !== "quantity" && data.trackingMode !== "individual") return null;
  if (typeof data.totalQuantity !== "number" || !Number.isInteger(data.totalQuantity) || data.totalQuantity < 0) return null;
  const checkedOutQuantity = typeof data.checkedOutQuantity === "number" && Number.isInteger(data.checkedOutQuantity) && data.checkedOutQuantity >= 0
    ? data.checkedOutQuantity
    : 0;
  const unavailableQuantity = typeof data.unavailableQuantity === "number" && Number.isInteger(data.unavailableQuantity) && data.unavailableQuantity >= 0
    ? data.unavailableQuantity
    : 0;
  if (checkedOutQuantity + unavailableQuantity > data.totalQuantity) return null;
  const condition = data.condition;
  if (!["good", "needs-attention", "repair", "missing", "lost", "retired"].includes(String(condition))) return null;
  return {
    id,
    name: data.name,
    category: data.category,
    trackingMode: data.trackingMode,
    totalQuantity: data.totalQuantity,
    checkedOutQuantity,
    unavailableQuantity,
    location: data.location,
    condition: condition as EquipmentCondition,
    notes: typeof data.notes === "string" ? data.notes : "",
    replacementValue: typeof data.replacementValue === "number" ? data.replacementValue : null,
    archived: data.archived === true,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : ""
  };
}

export async function loadEquipmentItems(): Promise<EquipmentItem[]> {
  const snapshot = await getDocs(collection(db, "equipmentItems"));
  return snapshot.docs
    .map((item) => mapItem(item.id, item.data()))
    .filter((item): item is EquipmentItem => item !== null)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export async function loadEquipmentOptions(kind: "categories" | "locations"): Promise<EquipmentOption[]> {
  const snapshot = await getDocs(collection(db, kind === "categories" ? "equipmentCategories" : "equipmentLocations"));
  return snapshot.docs
    .flatMap((item) => typeof item.data().name === "string" ? [{ id: item.id, name: item.data().name as string }] : [])
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function addEquipmentOption(kind: "categories" | "locations", name: string): Promise<EquipmentOption> {
  const safeName = normaliseEquipmentLabel(name);
  if (!safeName) throw new Error(`Enter a ${kind === "categories" ? "category" : "location"} name.`);
  const uid = currentUid();
  const result = await addDoc(collection(db, kind === "categories" ? "equipmentCategories" : "equipmentLocations"), {
    name: safeName,
    createdBy: uid,
    createdAt: serverTimestamp()
  });
  await recordAuditEvent({
    category: "equipment",
    action: `${kind === "categories" ? "category" : "location"}-created`,
    targetId: result.id,
    targetLabel: safeName,
    description: `Created equipment ${kind === "categories" ? "category" : "location"} ${safeName}.`,
    section: "Group"
  });
  return { id: result.id, name: safeName };
}

export async function deleteEquipmentOption(kind: "categories" | "locations", option: EquipmentOption): Promise<void> {
  await deleteDoc(doc(db, kind === "categories" ? "equipmentCategories" : "equipmentLocations", option.id));
  await recordAuditEvent({
    category: "equipment",
    action: `${kind === "categories" ? "category" : "location"}-deleted`,
    targetId: option.id,
    targetLabel: option.name,
    description: `Deleted unused equipment ${kind === "categories" ? "category" : "location"} ${option.name}.`,
    section: "Group"
  });
}

export async function createEquipmentItem(input: EquipmentItemInput): Promise<string> {
  const uid = currentUid();
  const payload = {
    ...input,
    name: normaliseEquipmentLabel(input.name),
    category: normaliseEquipmentLabel(input.category),
    location: normaliseEquipmentLabel(input.location),
    notes: input.notes.trim(),
    checkedOutQuantity: 0,
    unavailableQuantity: 0,
    archived: false,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedBy: uid,
    updatedAt: serverTimestamp()
  };
  const result = await addDoc(collection(db, "equipmentItems"), payload);
  await recordEquipmentHistory({
    itemId: result.id,
    itemName: payload.name,
    type: "item-created",
    quantity: payload.totalQuantity,
    section: "Group",
    fromLocation: "",
    toLocation: payload.location,
    details: `Added ${payload.totalQuantity} × ${payload.name} to Equipment & Stores at ${payload.location}.`,
    sourceId: result.id,
    linkedItemId: ""
  });
  await recordAuditEvent({
    category: "equipment",
    action: "item-created",
    targetId: result.id,
    targetLabel: payload.name,
    description: `Added ${payload.totalQuantity} × ${payload.name} to Equipment & Stores at ${payload.location}.`,
    section: "Group"
  });
  return result.id;
}

export async function updateEquipmentItem(itemId: string, input: EquipmentItemInput): Promise<void> {
  const uid = currentUid();
  await updateDoc(doc(db, "equipmentItems", itemId), {
    ...input,
    name: normaliseEquipmentLabel(input.name),
    category: normaliseEquipmentLabel(input.category),
    location: normaliseEquipmentLabel(input.location),
    notes: input.notes.trim(),
    updatedBy: uid,
    updatedAt: serverTimestamp()
  });
  await recordEquipmentHistory({
    itemId,
    itemName: input.name,
    type: "item-updated",
    quantity: input.totalQuantity,
    section: "Group",
    fromLocation: input.location,
    toLocation: input.location,
    details: `Updated inventory details for ${input.name}; total stock is ${input.totalQuantity}.`,
    sourceId: itemId,
    linkedItemId: ""
  });
  await recordAuditEvent({
    category: "equipment",
    action: "item-updated",
    targetId: itemId,
    targetLabel: input.name,
    description: `Updated equipment item ${input.name}.`,
    section: "Group"
  });
}

export async function setEquipmentArchived(item: EquipmentItem, archived: boolean): Promise<void> {
  if (archived && (item.checkedOutQuantity > 0 || item.unavailableQuantity > 0)) {
    throw new Error("Resolve all checked-out or unavailable stock before archiving this item.");
  }
  const uid = currentUid();
  await setDoc(doc(db, "equipmentItems", item.id), {
    archived,
    updatedBy: uid,
    updatedAt: serverTimestamp()
  }, { merge: true });
  await recordEquipmentHistory({
    itemId: item.id,
    itemName: item.name,
    type: archived ? "item-archived" : "item-restored",
    quantity: item.totalQuantity,
    section: "Group",
    fromLocation: item.location,
    toLocation: item.location,
    details: `${archived ? "Archived" : "Restored"} equipment item ${item.name}.`,
    sourceId: item.id,
    linkedItemId: ""
  });
  await recordAuditEvent({
    category: "equipment",
    action: archived ? "item-archived" : "item-restored",
    targetId: item.id,
    targetLabel: item.name,
    description: `${archived ? "Archived" : "Restored"} equipment item ${item.name}.`,
    section: "Group"
  });
}
