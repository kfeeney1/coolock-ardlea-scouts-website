import type { AdminProfile } from "../components/admin/AdminAuthProvider";
import type { EquipmentItem } from "./equipment";
import { canManageEquipment } from "./equipmentLogic";

export const EQUIPMENT_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group"] as const;

export type EquipmentLoanLine = {
  itemId: string;
  itemName: string;
  quantity: number;
  returnedQuantity: number;
};

export function availableEquipmentQuantity(item: Pick<EquipmentItem, "totalQuantity" | "checkedOutQuantity">): number {
  return Math.max(0, item.totalQuantity - item.checkedOutQuantity);
}

export function outstandingLoanQuantity(line: EquipmentLoanLine): number {
  return Math.max(0, line.quantity - line.returnedQuantity);
}

export function canUseEquipmentForSection(profile: AdminProfile | null, section: string): boolean {
  if (!profile || !section) return false;
  return canManageEquipment(profile) || profile.sections.includes(section);
}

export function checkoutSectionOptions(profile: AdminProfile | null): string[] {
  if (!profile) return [];
  if (canManageEquipment(profile)) {
    return Array.from(new Set([...EQUIPMENT_SECTIONS, ...profile.sections])).sort((a, b) => a.localeCompare(b));
  }
  return [...profile.sections].sort((a, b) => a.localeCompare(b));
}

export function validateCheckoutQuantity(item: EquipmentItem, requested: number): string | null {
  if (!Number.isInteger(requested) || requested < 0) return "Quantity must be a whole number of zero or more.";
  if (requested === 0) return null;
  if (item.archived) return `${item.name} is archived and cannot be checked out.`;
  const available = availableEquipmentQuantity(item);
  if (requested > available) return `Only ${available} × ${item.name} ${available === 1 ? "is" : "are"} available.`;
  return null;
}

export function loanIsComplete(lines: EquipmentLoanLine[]): boolean {
  return lines.every((line) => outstandingLoanQuantity(line) === 0);
}
