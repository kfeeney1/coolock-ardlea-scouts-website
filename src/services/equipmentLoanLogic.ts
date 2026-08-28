export const EQUIPMENT_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group"] as const;

export type EquipmentLoanProfile = {
  role: string;
  sections: string[];
  scoutingRole: string;
};

export type EquipmentAvailabilityItem = {
  name: string;
  totalQuantity: number;
  checkedOutQuantity: number;
  unavailableQuantity?: number;
  archived: boolean;
};

export type EquipmentLoanLine = {
  itemId: string;
  itemName: string;
  quantity: number;
  returnedQuantity: number;
  incidentQuantity?: number;
};

function isQuartermasterRole(role: string): boolean {
  const key = role
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  return key === "group quartermaster"
    || key === "group quartermaster/bo'sun"
    || key === "group bo'sun";
}

function canManageEquipment(profile: EquipmentLoanProfile): boolean {
  return profile.role === "admin"
    || profile.role === "super-admin"
    || profile.scoutingRole === "Group Leader"
    || isQuartermasterRole(profile.scoutingRole);
}

export function availableEquipmentQuantity(item: Pick<EquipmentAvailabilityItem, "totalQuantity" | "checkedOutQuantity" | "unavailableQuantity">): number {
  return Math.max(0, item.totalQuantity - item.checkedOutQuantity - (item.unavailableQuantity ?? 0));
}

export function outstandingLoanQuantity(line: EquipmentLoanLine): number {
  return Math.max(0, line.quantity - line.returnedQuantity - (line.incidentQuantity ?? 0));
}

export function canUseEquipmentForSection(profile: EquipmentLoanProfile | null, section: string): boolean {
  if (!profile || !section) return false;
  return canManageEquipment(profile) || profile.sections.includes(section);
}

export function checkoutSectionOptions(profile: EquipmentLoanProfile | null): string[] {
  if (!profile) return [];
  if (canManageEquipment(profile)) {
    return Array.from(new Set([...EQUIPMENT_SECTIONS, ...profile.sections])).sort((a, b) => a.localeCompare(b));
  }
  return [...profile.sections].sort((a, b) => a.localeCompare(b));
}

export function validateCheckoutQuantity(item: EquipmentAvailabilityItem, requested: number): string | null {
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
