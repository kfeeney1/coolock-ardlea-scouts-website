import { Box, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import type { EquipmentItem } from "../../services/equipment";
import type { EquipmentIncident } from "../../services/equipmentIncidents";
import type { EquipmentLoan } from "../../services/equipmentLoans";
import {
  currentSectionHoldingsCsv,
  equipmentByCategoryCsv,
  equipmentByLocationCsv,
  equipmentInventoryCsv,
  equipmentUsageCsv,
  lossDamageHistoryCsv,
  missingLostEquipmentCsv,
  overdueEquipmentCsv,
  repairMaintenanceCsv,
  writeOffReplacementCsv,
  type EquipmentReportFilters
} from "../../services/equipmentReportingLogic";

const REPORTS = [
  ["inventory", "Inventory Summary"],
  ["location", "Equipment by Location"],
  ["category", "Equipment by Category"],
  ["holdings", "Current Section Holdings"],
  ["overdue", "Overdue Equipment"],
  ["repair", "Repair / Maintenance List"],
  ["missing", "Missing / Lost Equipment"],
  ["history", "Loss & Damage History"],
  ["usage", "Equipment Usage"],
  ["writeoffs", "Write-offs / Replacement Value"]
] as const;

type ReportId = typeof REPORTS[number][0];

type Props = {
  items: EquipmentItem[];
  loans: EquipmentLoan[];
  incidents: EquipmentIncident[];
  canManage: boolean;
};

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function EquipmentReportsPanel({ items, loans, incidents, canManage }: Props) {
  const [report, setReport] = useState<ReportId>("inventory");
  const [section, setSection] = useState("all");
  const [itemId, setItemId] = useState("all");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const sections = useMemo(() => [...new Set(loans.map((loan) => loan.section).filter(Boolean))].sort(), [loans]);
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const locations = useMemo(() => [...new Set(items.map((item) => item.location).filter(Boolean))].sort(), [items]);
  const activeItems = useMemo(() => items.filter((item) => !item.archived).sort((a, b) => a.name.localeCompare(b.name)), [items]);

  const filters: EquipmentReportFilters = { section, itemId, category, location, status, fromDate, toDate };
  const today = new Date().toISOString().slice(0, 10);

  const build = (id: ReportId) => {
    if (id === "inventory") return equipmentInventoryCsv(items, filters);
    if (id === "location") return equipmentByLocationCsv(items, filters);
    if (id === "category") return equipmentByCategoryCsv(items, filters);
    if (id === "holdings") return currentSectionHoldingsCsv(loans, filters);
    if (id === "overdue") return overdueEquipmentCsv(loans, today, filters);
    if (id === "repair") return repairMaintenanceCsv(items, incidents, filters);
    if (id === "missing") return missingLostEquipmentCsv(incidents, filters);
    if (id === "history") return lossDamageHistoryCsv(incidents, filters);
    if (id === "usage") return equipmentUsageCsv(loans, filters);
    return writeOffReplacementCsv(items, incidents, filters);
  };

  const exportReport = (id: ReportId) => {
    const label = REPORTS.find(([value]) => value === id)?.[1] ?? "Equipment Report";
    downloadCsv(`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${today}.csv`, build(id));
  };

  return <Paper sx={{ p: { xs: 2, md: 3 }, mb: 2 }} data-testid="equipment-reports-panel">
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" }, mb: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Equipment Reports</Typography>
        <Typography color="text.secondary">Export stock, holdings, overdue items, maintenance, incidents, usage and replacement-value reports as CSV.</Typography>
      </Box>
      {canManage && <Button variant="contained" color="success" onClick={() => downloadCsv(`all-equipment-${today}.csv`, equipmentInventoryCsv(items))} data-testid="export-all-equipment-csv">Export all equipment CSV</Button>}
    </Stack>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,minmax(0,1fr))" }, gap: 1.5 }}>
      <TextField select label="Report" value={report} onChange={(event) => setReport(event.target.value as ReportId)}>{REPORTS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <TextField select label="Section" value={section} onChange={(event) => setSection(event.target.value)}><MenuItem value="all">All sections</MenuItem>{sections.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      <TextField select label="Equipment item" value={itemId} onChange={(event) => setItemId(event.target.value)}><MenuItem value="all">All equipment</MenuItem>{activeItems.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
      <TextField select label="Category" value={category} onChange={(event) => setCategory(event.target.value)}><MenuItem value="all">All categories</MenuItem>{categories.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      <TextField select label="Location" value={location} onChange={(event) => setLocation(event.target.value)}><MenuItem value="all">All locations</MenuItem>{locations.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      <TextField select label="Status / issue" value={status} onChange={(event) => setStatus(event.target.value)}>
        <MenuItem value="all">All statuses</MenuItem><MenuItem value="active">Active stock</MenuItem><MenuItem value="archived">Archived stock</MenuItem><MenuItem value="good">Good</MenuItem><MenuItem value="needs-attention">Needs attention</MenuItem><MenuItem value="repair">Repair</MenuItem><MenuItem value="missing">Missing</MenuItem><MenuItem value="lost">Lost</MenuItem><MenuItem value="reported">Reported</MenuItem><MenuItem value="investigating">Investigating</MenuItem><MenuItem value="resolved">Resolved</MenuItem><MenuItem value="written-off">Written off</MenuItem>
      </TextField>
      <TextField label="From date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField label="To date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <Button variant="outlined" onClick={() => exportReport(report)} data-testid="export-selected-equipment-report">Export selected report CSV</Button>
    </Box>
  </Paper>;
}
