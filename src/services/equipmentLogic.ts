import type { AdminProfile } from "../components/admin/AdminAuthProvider";

export const DEFAULT_EQUIPMENT_CATEGORIES = [
  "Camping & Sleeping",
  "Cooking",
  "Pioneering",
  "Water Activities",
  "Hiking & Navigation",
  "Games & Programme",
  "Tools & Maintenance",
  "Safety & First Aid",
  "Electrical",
  "Furniture & Storage",
  "Other"
] as const;

export type EquipmentTrackingMode = "quantity" | "individual";
export type EquipmentCondition = "good" | "needs-attention" | "repair" | "missing" | "lost" | "retired";

export function normaliseEquipmentLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function equipmentLabelKey(value: string): string {
  return normaliseEquipmentLabel(value).toLocaleLowerCase("en-IE");
}

export function isDuplicateEquipmentLabel(value: string, existing: string[]): boolean {
  const key = equipmentLabelKey(value);
  return Boolean(key) && existing.some((item) => equipmentLabelKey(item) === key);
}

export function isDuplicateEquipmentItemName(
  value: string,
  items: Array<{ id: string; name: string }>,
  currentItemId?: string
): boolean {
  const key = equipmentLabelKey(value);
  return Boolean(key) && items.some((item) => item.id !== currentItemId && equipmentLabelKey(item.name) === key);
}

export function isQuartermasterRole(role: string): boolean {
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

export function canManageEquipment(profile: AdminProfile | null): boolean {
  if (!profile) return false;
  return profile.role === "admin"
    || profile.role === "super-admin"
    || profile.scoutingRole === "Group Leader"
    || isQuartermasterRole(profile.scoutingRole);
}

export function canDeleteEquipmentOption(option: string, inUseValues: string[]): boolean {
  return !inUseValues.some((value) => equipmentLabelKey(value) === equipmentLabelKey(option));
}
