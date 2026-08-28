import { csvCell } from "./reportingLogic.ts";
import { isEquipmentReservationLoan } from "./equipmentProgrammeLogic.ts";

export type EquipmentReportItem = {
  id: string;
  name: string;
  category: string;
  trackingMode: "quantity" | "individual";
  totalQuantity: number;
  checkedOutQuantity: number;
  unavailableQuantity: number;
  location: string;
  condition: string;
  notes: string;
  replacementValue: number | null;
  archived: boolean;
};

export type EquipmentReportLoan = {
  id: string;
  section: string;
  expectedReturnDate: string;
  notes: string;
  status: "open" | "returned";
  lines: Array<{ itemId: string; itemName: string; quantity: number; returnedQuantity: number; incidentQuantity: number }>;
};

export type EquipmentReportIncident = {
  id: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  itemLocation: string;
  quantity: number;
  type: string;
  status: string;
  section: string;
  description: string;
  reportedAt: Date | null;
  resolutionType: string;
  resolutionNotes: string;
  resolvedAt: Date | null;
};

export type EquipmentReportFilters = {
  section?: string;
  itemId?: string;
  category?: string;
  location?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
};

const available = (item: EquipmentReportItem) => Math.max(0, item.totalQuantity - item.checkedOutQuantity - item.unavailableQuantity);
const outstanding = (line: EquipmentReportLoan["lines"][number]) => Math.max(0, line.quantity - line.returnedQuantity - line.incidentQuantity);
const dateValue = (value: Date | null) => value ? value.toISOString().slice(0, 10) : "";
const money = (value: number | null) => value === null ? "" : value.toFixed(2);
const row = (values: unknown[]) => values.map(csvCell).join(",");
const csv = (header: string[], rows: unknown[][]) => [row(header), ...rows.map(row)].join("\r\n");

function filterItems(items: EquipmentReportItem[], filters: EquipmentReportFilters): EquipmentReportItem[] {
  return items.filter((item) => {
    if (filters.itemId && filters.itemId !== "all" && item.id !== filters.itemId) return false;
    if (filters.category && filters.category !== "all" && item.category !== filters.category) return false;
    if (filters.location && filters.location !== "all" && item.location !== filters.location) return false;
    if (filters.status && filters.status !== "all") {
      if (filters.status === "archived" && !item.archived) return false;
      if (filters.status === "active" && item.archived) return false;
      if (!["archived", "active"].includes(filters.status) && item.condition !== filters.status) return false;
    }
    return true;
  });
}

function filterLoans(loans: EquipmentReportLoan[], filters: EquipmentReportFilters): EquipmentReportLoan[] {
  return loans.filter((loan) => {
    if (filters.section && filters.section !== "all" && loan.section !== filters.section) return false;
    if (filters.fromDate && loan.expectedReturnDate < filters.fromDate) return false;
    if (filters.toDate && loan.expectedReturnDate > filters.toDate) return false;
    if (filters.itemId && filters.itemId !== "all" && !loan.lines.some((line) => line.itemId === filters.itemId)) return false;
    return true;
  });
}

function filterIncidents(incidents: EquipmentReportIncident[], filters: EquipmentReportFilters): EquipmentReportIncident[] {
  return incidents.filter((incident) => {
    if (filters.section && filters.section !== "all" && incident.section !== filters.section) return false;
    if (filters.itemId && filters.itemId !== "all" && incident.itemId !== filters.itemId) return false;
    if (filters.category && filters.category !== "all" && incident.itemCategory !== filters.category) return false;
    if (filters.location && filters.location !== "all" && incident.itemLocation !== filters.location) return false;
    if (filters.status && filters.status !== "all" && incident.status !== filters.status && incident.type !== filters.status && incident.resolutionType !== filters.status) return false;
    const date = dateValue(incident.reportedAt);
    if (filters.fromDate && date && date < filters.fromDate) return false;
    if (filters.toDate && date && date > filters.toDate) return false;
    return true;
  });
}

export function equipmentInventoryCsv(items: EquipmentReportItem[], filters: EquipmentReportFilters = {}): string {
  const body = filterItems(items, filters)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .map((item) => [item.name, item.category, item.location, item.trackingMode, item.condition, item.totalQuantity, available(item), item.checkedOutQuantity, item.unavailableQuantity, money(item.replacementValue), item.replacementValue === null ? "" : money(item.replacementValue * item.totalQuantity), item.archived ? "Yes" : "No", item.notes]);
  return csv(["Equipment", "Category", "Location", "Tracking", "Condition", "Total", "Available", "Checked out / reserved", "Unavailable", "Replacement value each (€)", "Total replacement value (€)", "Archived", "Notes"], body);
}

export function equipmentByLocationCsv(items: EquipmentReportItem[], filters: EquipmentReportFilters = {}): string {
  const scoped = filterItems(items, filters).sort((a, b) => a.location.localeCompare(b.location) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return csv(["Location", "Equipment", "Category", "Condition", "Total", "Available", "Checked out / reserved", "Unavailable"], scoped.map((item) => [item.location, item.name, item.category, item.condition, item.totalQuantity, available(item), item.checkedOutQuantity, item.unavailableQuantity]));
}

export function equipmentByCategoryCsv(items: EquipmentReportItem[], filters: EquipmentReportFilters = {}): string {
  const scoped = filterItems(items, filters).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return csv(["Category", "Equipment", "Location", "Condition", "Total", "Available", "Checked out / reserved", "Unavailable"], scoped.map((item) => [item.category, item.name, item.location, item.condition, item.totalQuantity, available(item), item.checkedOutQuantity, item.unavailableQuantity]));
}

export function currentSectionHoldingsCsv(loans: EquipmentReportLoan[], filters: EquipmentReportFilters = {}): string {
  const rows = filterLoans(loans, filters)
    .filter((loan) => loan.status === "open" && !isEquipmentReservationLoan(loan))
    .flatMap((loan) => loan.lines.map((line) => [loan.section, line.itemName, outstanding(line), loan.expectedReturnDate, loan.id]).filter((entry) => Number(entry[2]) > 0));
  return csv(["Section", "Equipment", "Outstanding quantity", "Expected return", "Checkout ID"], rows);
}

export function overdueEquipmentCsv(loans: EquipmentReportLoan[], today: string, filters: EquipmentReportFilters = {}): string {
  const rows = filterLoans(loans, filters)
    .filter((loan) => loan.status === "open" && !isEquipmentReservationLoan(loan) && loan.expectedReturnDate < today)
    .flatMap((loan) => loan.lines.map((line) => [loan.section, line.itemName, outstanding(line), loan.expectedReturnDate, loan.id]).filter((entry) => Number(entry[2]) > 0));
  return csv(["Section", "Equipment", "Outstanding quantity", "Expected return", "Checkout ID"], rows);
}

export function repairMaintenanceCsv(items: EquipmentReportItem[], incidents: EquipmentReportIncident[], filters: EquipmentReportFilters = {}): string {
  const itemIds = new Set(filterItems(items, filters).filter((item) => ["needs-attention", "repair"].includes(item.condition) || item.unavailableQuantity > 0).map((item) => item.id));
  const rows = filterIncidents(incidents, filters)
    .filter((incident) => incident.status !== "resolved" && (incident.type === "damaged" || incident.type === "maintenance") && (itemIds.size === 0 || itemIds.has(incident.itemId)))
    .map((incident) => [incident.itemName, incident.itemCategory, incident.itemLocation, incident.quantity, incident.type, incident.status, incident.section, dateValue(incident.reportedAt), incident.description]);
  return csv(["Equipment", "Category", "Location", "Quantity", "Issue", "Status", "Section", "Reported", "Description"], rows);
}

export function missingLostEquipmentCsv(incidents: EquipmentReportIncident[], filters: EquipmentReportFilters = {}): string {
  const rows = filterIncidents(incidents, filters).filter((incident) => incident.status !== "resolved" && ["missing", "lost"].includes(incident.type)).map((incident) => [incident.itemName, incident.itemCategory, incident.itemLocation, incident.quantity, incident.type, incident.status, incident.section, dateValue(incident.reportedAt), incident.description]);
  return csv(["Equipment", "Category", "Location", "Quantity", "Issue", "Status", "Section", "Reported", "Description"], rows);
}

export function lossDamageHistoryCsv(incidents: EquipmentReportIncident[], filters: EquipmentReportFilters = {}): string {
  const rows = filterIncidents(incidents, filters).filter((incident) => ["damaged", "lost", "missing"].includes(incident.type)).map((incident) => [incident.itemName, incident.quantity, incident.type, incident.status, incident.section, dateValue(incident.reportedAt), incident.description, incident.resolutionType, dateValue(incident.resolvedAt), incident.resolutionNotes]);
  return csv(["Equipment", "Quantity", "Issue", "Status", "Section", "Reported", "Description", "Resolution", "Resolved", "Resolution notes"], rows);
}

export function equipmentUsageCsv(loans: EquipmentReportLoan[], filters: EquipmentReportFilters = {}): string {
  const totals = new Map<string, { itemName: string; issued: number; returned: number; incident: number; transactions: number }>();
  for (const loan of filterLoans(loans, filters).filter((entry) => !isEquipmentReservationLoan(entry))) {
    for (const line of loan.lines) {
      if (filters.itemId && filters.itemId !== "all" && line.itemId !== filters.itemId) continue;
      const current = totals.get(line.itemId) ?? { itemName: line.itemName, issued: 0, returned: 0, incident: 0, transactions: 0 };
      current.issued += line.quantity;
      current.returned += line.returnedQuantity;
      current.incident += line.incidentQuantity;
      current.transactions += 1;
      totals.set(line.itemId, current);
    }
  }
  return csv(["Equipment", "Checkout transactions", "Quantity issued", "Quantity returned", "Incident quantity"], [...totals.values()].sort((a, b) => b.issued - a.issued || a.itemName.localeCompare(b.itemName)).map((entry) => [entry.itemName, entry.transactions, entry.issued, entry.returned, entry.incident]));
}

export function writeOffReplacementCsv(items: EquipmentReportItem[], incidents: EquipmentReportIncident[], filters: EquipmentReportFilters = {}): string {
  const values = new Map(filterItems(items, filters).map((item) => [item.id, item.replacementValue]));
  const rows = filterIncidents(incidents, filters).filter((incident) => incident.resolutionType === "written-off").map((incident) => {
    const each = values.get(incident.itemId) ?? null;
    return [incident.itemName, incident.quantity, dateValue(incident.resolvedAt), incident.section, incident.resolutionNotes, money(each), each === null ? "" : money(each * incident.quantity)];
  });
  return csv(["Equipment", "Quantity written off", "Resolved", "Section", "Reason / notes", "Replacement value each (€)", "Estimated replacement value (€)"], rows);
}
