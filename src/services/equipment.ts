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
import { normaliseEquipmentLabel } from "./equipmentLogic";
import type { EquipmentCondition, EquipmentTrackingMode } from "./equipmentLogic";

export type EquipmentItem = {
  id: string;
  name: string;
  category: string;
  trackingMode: EquipmentTrackingMode;
  totalQuantity: number;
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

export type EquipmentItemInput = Omit<EquipmentItem, "id" | "createdBy" | "updatedBy" | "archived">;

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to manage equipment.");
  return uid;
}

function mapItem(id: string, data: Record<string, unknown>): EquipmentItem | null {
  if (typeof data.name !== "string" || typeof data.category !== "string" || typeof data.location !== "string") return null;
  if (data.trackingMode !== "quantity" && data.trackingMode !== "individual") return null;
  if (typeof data.totalQuantity !== "number" || !Number.isInteger(data.totalQuantity) || data.totalQuantity < 0) return null;
  const condition = data.condition;
  if (!["good", "needs-attention", "repair", "missing", "lost", "retired"].includes(String(condition))) return null;
  return {
    id,
    name: data.name,
    category: data.category,
    trackingMode: data.trackingMode,
    totalQuantity: data.totalQuantity,
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
    archived: false,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedBy: uid,
    updatedAt: serverTimestamp()
  };
  const result = await addDoc(collection(db, "equipmentItems"), payload);
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
  const uid = currentUid();
  await setDoc(doc(db, "equipmentItems", item.id), {
    archived,
    updatedBy: uid,
    updatedAt: serverTimestamp()
  }, { merge: true });
  await recordAuditEvent({
    category: "equipment",
    action: archived ? "item-archived" : "item-restored",
    targetId: item.id,
    targetLabel: item.name,
    description: `${archived ? "Archived" : "Restored"} equipment item ${item.name}.`,
    section: "Group"
  });
}
