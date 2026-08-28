export type EquipmentHistoryType =
  | "item-created"
  | "item-updated"
  | "item-archived"
  | "item-restored"
  | "equipment-checked-out"
  | "equipment-returned"
  | "incident-reported"
  | "incident-investigating"
  | "incident-resolved"
  | "stock-moved"
  | "stock-moved-out"
  | "stock-moved-in";

export type StockMovementState = {
  totalQuantity: number;
  checkedOutQuantity: number;
  unavailableQuantity: number;
  archived: boolean;
  location: string;
};

export function equipmentHistoryLabel(type: EquipmentHistoryType): string {
  switch (type) {
    case "item-created": return "Added to inventory";
    case "item-updated": return "Inventory details updated";
    case "item-archived": return "Archived";
    case "item-restored": return "Restored";
    case "equipment-checked-out": return "Checked out";
    case "equipment-returned": return "Returned";
    case "incident-reported": return "Issue reported";
    case "incident-investigating": return "Issue under investigation";
    case "incident-resolved": return "Issue resolved";
    case "stock-moved": return "Moved storage location";
    case "stock-moved-out": return "Stock moved out";
    case "stock-moved-in": return "Stock moved in";
  }
}

export function availableStockForMovement(item: Pick<StockMovementState, "totalQuantity" | "checkedOutQuantity" | "unavailableQuantity">): number {
  return Math.max(0, item.totalQuantity - item.checkedOutQuantity - item.unavailableQuantity);
}

export function validateStockMovement(item: StockMovementState, quantity: number, destination: string): string {
  if (item.archived) return "Archived equipment cannot be moved.";
  if (!Number.isInteger(quantity) || quantity <= 0) return "Move quantity must be a whole number greater than zero.";
  const available = availableStockForMovement(item);
  if (quantity > available) return `Only ${available} available ${available === 1 ? "item can" : "items can"} be moved.`;
  const safeDestination = destination.trim();
  if (!safeDestination) return "Choose a destination storage location.";
  if (safeDestination.toLowerCase() === item.location.trim().toLowerCase()) return "Choose a different storage location.";
  return "";
}
