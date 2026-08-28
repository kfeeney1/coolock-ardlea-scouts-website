import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { EquipmentLoan } from "./equipmentLoans";
import { checkoutEquipment } from "./equipmentLoans";
import {
  equipmentProgrammeStatus,
  outstandingRequirementQuantity,
  type EquipmentProgrammeStatus,
} from "./equipmentProgrammeLogic";

export { equipmentProgrammeStatus, outstandingRequirementQuantity };
export type { EquipmentProgrammeStatus };

export type EquipmentProgrammeSourceType = "weeklyMeeting" | "event" | "activity";
export type EquipmentRequirementLine = { itemId: string; itemName: string; quantity: number };
export type EquipmentProgrammeRequirement = {
  id: string;
  sourceType: EquipmentProgrammeSourceType;
  sourceId: string;
  sourceLabel: string;
  section: string;
  date: string;
  lines: EquipmentRequirementLine[];
  loanId: string;
};

function uid(): string {
  const value = auth.currentUser?.uid;
  if (!value) throw new Error("Leader authentication is required.");
  return value;
}

function requirementId(sourceType: EquipmentProgrammeSourceType, sourceId: string): string {
  return `${sourceType}-${sourceId}`;
}

function mapRequirement(id: string, data: Record<string, unknown>): EquipmentProgrammeRequirement | null {
  if (!["weeklyMeeting", "event", "activity"].includes(String(data.sourceType))) return null;
  if (typeof data.sourceId !== "string" || typeof data.sourceLabel !== "string" || typeof data.section !== "string" || typeof data.date !== "string") return null;
  if (!Array.isArray(data.lines)) return null;
  const lines = data.lines.map((value) => {
    if (!value || typeof value !== "object") return null;
    const line = value as Record<string, unknown>;
    if (typeof line.itemId !== "string" || typeof line.itemName !== "string" || typeof line.quantity !== "number" || !Number.isInteger(line.quantity) || line.quantity <= 0) return null;
    return { itemId: line.itemId, itemName: line.itemName, quantity: line.quantity };
  }).filter((line): line is EquipmentRequirementLine => line !== null);
  if (lines.length !== data.lines.length) return null;
  return { id, sourceType: data.sourceType as EquipmentProgrammeSourceType, sourceId: data.sourceId, sourceLabel: data.sourceLabel, section: data.section, date: data.date, lines, loanId: typeof data.loanId === "string" ? data.loanId : "" };
}

export async function loadEquipmentRequirement(sourceType: EquipmentProgrammeSourceType, sourceId: string): Promise<EquipmentProgrammeRequirement | null> {
  const snapshot = await getDocs(query(collection(db, "equipmentProgrammeRequirements"), where("sourceType", "==", sourceType), where("sourceId", "==", sourceId)));
  const first = snapshot.docs[0];
  return first ? mapRequirement(first.id, first.data()) : null;
}

export async function saveEquipmentRequirement(input: Omit<EquipmentProgrammeRequirement, "id" | "loanId">, existingLoanId = ""): Promise<void> {
  const userId = uid();
  const lines = input.lines.filter((line) => line.itemId && line.itemName.trim() && Number.isInteger(line.quantity) && line.quantity > 0);
  const ref = doc(db, "equipmentProgrammeRequirements", requirementId(input.sourceType, input.sourceId));
  await setDoc(ref, { ...input, lines, loanId: existingLoanId, updatedBy: userId, updatedAt: serverTimestamp(), createdBy: userId, createdAt: serverTimestamp() }, { merge: true });
}

export async function checkoutEquipmentRequirement(requirement: EquipmentProgrammeRequirement, expectedReturnDate: string): Promise<string> {
  if (!requirement.lines.length) throw new Error("Add planned equipment before creating a checkout.");
  const loanId = await checkoutEquipment({ section: requirement.section, expectedReturnDate, notes: `${requirement.sourceLabel} · planned equipment`, lines: requirement.lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })) });
  await saveEquipmentRequirement({ sourceType: requirement.sourceType, sourceId: requirement.sourceId, sourceLabel: requirement.sourceLabel, section: requirement.section, date: requirement.date, lines: requirement.lines }, loanId);
  return loanId;
}

export function getEquipmentProgrammeStatus(requirement: EquipmentProgrammeRequirement | null, loans: EquipmentLoan[]): EquipmentProgrammeStatus {
  return equipmentProgrammeStatus(requirement, loans);
}
