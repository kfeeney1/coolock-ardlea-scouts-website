export type EquipmentIncidentType = "damaged" | "lost" | "missing" | "maintenance";
export type EquipmentIncidentStatus = "reported" | "investigating" | "resolved";
export type EquipmentNotificationState = "pending" | "sent" | "failed";

export type IncidentAvailabilityItem = {
  name: string;
  totalQuantity: number;
  checkedOutQuantity: number;
  unavailableQuantity: number;
  archived: boolean;
};

export function incidentTypeLabel(type: EquipmentIncidentType): string {
  if (type === "damaged") return "Broken / damaged";
  if (type === "lost") return "Lost";
  if (type === "missing") return "Missing";
  return "Needs cleaning / maintenance";
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

export function validateIncidentQuantity(item: IncidentAvailabilityItem, requested: number, fromLoanOutstanding = 0): string | null {
  if (!Number.isInteger(requested) || requested <= 0) return "Issue quantity must be a whole number greater than zero.";
  if (item.archived) return `${item.name} is archived and cannot have a new issue reported.`;
  const maximum = fromLoanOutstanding > 0 ? fromLoanOutstanding : availableAfterUnavailable(item);
  if (requested > maximum) return `Only ${maximum} × ${item.name} can be reported from this source.`;
  return null;
}
