import type { EquipmentItem } from "./equipment";
import { availableEquipmentQuantity } from "./equipmentLoanLogic";

export type EquipmentInventoryStatusFilter = "all" | "available" | "checked-out" | "unavailable";

export type EquipmentInventoryFilters = {
  search: string;
  category: string;
  store: string;
  status: EquipmentInventoryStatusFilter;
  showArchived: boolean;
};

export const UNASSIGNED_EQUIPMENT_STORE = "__unassigned__";

export function equipmentMatchesInventoryFilters(item: EquipmentItem, filters: EquipmentInventoryFilters): boolean {
  if (!filters.showArchived && item.archived) return false;
  if (filters.category !== "all" && item.category !== filters.category) return false;
  if (filters.store === UNASSIGNED_EQUIPMENT_STORE && item.location.trim()) return false;
  if (filters.store !== "all" && filters.store !== UNASSIGNED_EQUIPMENT_STORE && item.location !== filters.store) return false;
  if (filters.status === "available" && availableEquipmentQuantity(item) <= 0) return false;
  if (filters.status === "checked-out" && item.checkedOutQuantity <= 0) return false;
  if (filters.status === "unavailable" && item.unavailableQuantity <= 0) return false;
  const query = filters.search.trim().toLowerCase();
  if (!query) return true;
  return [item.name, item.category, item.location, item.notes].join(" ").toLowerCase().includes(query);
}

export function equipmentStoreNames(items: EquipmentItem[], configuredLocations: string[]): string[] {
  return Array.from(new Set([
    ...configuredLocations.map((value) => value.trim()).filter(Boolean),
    ...items.map((item) => item.location.trim()).filter(Boolean)
  ])).sort((a, b) => a.localeCompare(b));
}
