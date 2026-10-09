import { UserFacingError } from "./applicationErrors.ts";
export type EquipmentIncidentType = "damaged" | "lost" | "missing" | "maintenance";
export type EquipmentIncidentStatus = "reported" | "investigating" | "resolved";
export type EquipmentNotificationState = "pending" | "sent" | "failed";
export type EquipmentIncidentResolution = "found-returned" | "repaired" | "replaced" | "written-off" | "no-action";

export type IncidentAvailabilityItem = {
  name: string;
  totalQuantity: number;
  checkedOutQuantity: number;
  unavailableQuantity: number;
  archived: boolean;
};

export type UnadjustedEquipmentIncident = {
  itemId: string;
  quantity: number;
  type: EquipmentIncidentType;
  status: EquipmentIncidentStatus;
  loanId?: string;
  stockAdjusted?: boolean;
};

export function incidentTypeLabel(type: EquipmentIncidentType): string {
  if (type === "damaged") return "Broken / damaged";
  if (type === "lost") return "Lost";
  if (type === "missing") return "Missing";
  return "Needs cleaning / maintenance";
}

export function incidentStatusLabel(status: EquipmentIncidentStatus): string {
  if (status === "investigating") return "Investigating";
  if (status === "resolved") return "Resolved";
  return "Reported";
}

export function incidentResolutionLabel(resolution: EquipmentIncidentResolution): string {
  if (resolution === "found-returned") return "Found / returned";
  if (resolution === "repaired") return "Repaired";
  if (resolution === "replaced") return "Replaced";
  if (resolution === "written-off") return "Written off";
  return "No action required";
}

export function incidentRemovesAvailability(type: EquipmentIncidentType): boolean {
  return ["damaged", "lost", "missing", "maintenance"].includes(type);
}

export function incidentRequiresUrgentNotification(type: EquipmentIncidentType): boolean {
  return type === "damaged" || type === "lost" || type === "missing";
}

export function availableAfterUnavailable(item: Pick<IncidentAvailabilityItem, "totalQuantity" | "checkedOutQuantity" | "unavailableQuantity">): number {
  return Math.max(0, item.totalQuantity - item.checkedOutQuantity - item.unavailableQuantity);
}

/**
 * Older catalogue-only issue reports did not move stock into unavailableQuantity.
 * Count those active reports once while leaving newer, stock-adjusted reports to
 * the item counter. Cap legacy quantities to stock that is not already allocated.
 */
export function unadjustedIncidentUnavailableQuantity(
  itemId: string,
  item: Pick<IncidentAvailabilityItem, "totalQuantity" | "checkedOutQuantity" | "unavailableQuantity">,
  incidents: UnadjustedEquipmentIncident[]
): number {
  const outstanding = incidents.reduce((sum, incident) => {
    if (incident.itemId !== itemId || incident.status === "resolved" || incident.stockAdjusted === true || incident.loanId) return sum;
    if (!incidentRemovesAvailability(incident.type) || !Number.isInteger(incident.quantity) || incident.quantity <= 0) return sum;
    return sum + incident.quantity;
  }, 0);
  const unallocated = Math.max(0, item.totalQuantity - item.checkedOutQuantity - item.unavailableQuantity);
  return Math.min(outstanding, unallocated);
}

export function validateIncidentQuantity(item: IncidentAvailabilityItem, requested: number, fromLoanOutstanding = 0): string | null {
  if (!Number.isInteger(requested) || requested <= 0) return "Issue quantity must be a whole number greater than zero.";
  if (item.archived) return `${item.name} is archived and cannot have a new issue reported.`;
  const maximum = fromLoanOutstanding > 0 ? fromLoanOutstanding : availableAfterUnavailable(item);
  if (requested > maximum) return `Only ${maximum} × ${item.name} can be reported from this source.`;
  return null;
}

export function validateIncidentResolution(resolution: EquipmentIncidentResolution, notes: string): string | null {
  if (resolution === "written-off" && !notes.trim()) return "Add a reason before writing equipment off.";
  return null;
}

export function resolvedEquipmentQuantities(
  item: Pick<IncidentAvailabilityItem, "totalQuantity" | "checkedOutQuantity" | "unavailableQuantity">,
  incidentQuantity: number,
  resolution: EquipmentIncidentResolution
): { totalQuantity: number; unavailableQuantity: number } {
  if (!Number.isInteger(incidentQuantity) || incidentQuantity <= 0) throw new UserFacingError("Incident quantity must be a whole number greater than zero.");
  if (incidentQuantity > item.unavailableQuantity) throw new UserFacingError("The incident quantity is greater than the equipment currently marked unavailable.");
  const unavailableQuantity = item.unavailableQuantity - incidentQuantity;
  const totalQuantity = resolution === "written-off" ? item.totalQuantity - incidentQuantity : item.totalQuantity;
  if (totalQuantity < 0 || item.checkedOutQuantity + unavailableQuantity > totalQuantity) {
    throw new UserFacingError("Resolving this incident would make the equipment stock totals inconsistent.");
  }
  return { totalQuantity, unavailableQuantity };
}
