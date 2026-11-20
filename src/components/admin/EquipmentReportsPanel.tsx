import { Box, Button, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import DateRangeFields from "../DateRangeFields";
import type { EquipmentItem } from "../../services/equipment";
import type { EquipmentIncident } from "../../services/equipmentIncidents";
import type { EquipmentLoan } from "../../services/equipmentLoans";
import {
  currentSectionHoldingsRows,
  equipmentReportCsv,
  type EquipmentReportRows,
  equipmentByCategoryRows,
  equipmentByLocationRows,
  equipmentInventoryRows,
  equipmentAssetRegisterCsv,
  equipmentUsageRows,
  lossDamageHistoryRows,
  missingLostEquipmentRows,
  overdueEquipmentRows,
  repairMaintenanceRows,
  writeOffReplacementRows,
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
  canExport: boolean;
};

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function EquipmentReportsPanel({ items, loans, incidents, canExport }: Props) {
  const [report, setReport] = useState<ReportId>("inventory");
  const [section, setSection] = useState("all");
  const [itemId, setItemId] = useState("all");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [preview, setPreview] = useState<{ label: string; data: EquipmentReportRows } | null>(null);

  const sections = useMemo(() => [...new Set(loans.map((loan) => loan.section).filter(Boolean))].sort(), [loans]);
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const locations = useMemo(() => [...new Set(items.map((item) => item.location).filter(Boolean))].sort(), [items]);
  const activeItems = useMemo(() => items.filter((item) => !item.archived).sort((a, b) => a.name.localeCompare(b.name)), [items]);

  const filters: EquipmentReportFilters = { section, itemId, category, location, status, fromDate, toDate };
  const operationalSources = { loans, incidents };
  const today = new Date().toISOString().slice(0, 10);

  const build = (id: ReportId) => {
    if (id === "inventory") return equipmentInventoryRows(items, filters, operationalSources);
    if (id === "location") return equipmentByLocationRows(items, filters);
    if (id === "category") return equipmentByCategoryRows(items, filters);
    if (id === "holdings") return currentSectionHoldingsRows(loans, filters);
    if (id === "overdue") return overdueEquipmentRows(loans, today, filters);
    if (id === "repair") return repairMaintenanceRows(items, incidents, filters);
    if (id === "missing") return missingLostEquipmentRows(incidents, filters);
    if (id === "history") return lossDamageHistoryRows(incidents, filters);
    if (id === "usage") return equipmentUsageRows(loans, filters);
    return writeOffReplacementRows(items, incidents, filters);
  };

  const exportReport = (id: ReportId) => {
    if (!canExport) return;
    const label = REPORTS.find(([value]) => value === id)?.[1] ?? "Equipment Report";
    downloadCsv(`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${today}.csv`, equipmentReportCsv(build(id)));
  };

  return <Paper sx={{ minWidth: 0, p: { xs: 2, md: 3 }, mb: 2 }} data-testid="equipment-reports-panel">
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" }, mb: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Equipment Reports</Typography>
      </Box>
      {canExport && <Button variant="contained" color="success" onClick={() => downloadCsv(`all-equipment-${today}.csv`, equipmentReportCsv(equipmentInventoryRows(items, {}, operationalSources)))} data-testid="export-all-equipment-csv">Export all equipment CSV</Button>}
      {canExport && <Button variant="outlined" onClick={() => downloadCsv(`equipment-asset-register-${today}.csv`, equipmentAssetRegisterCsv(items))} data-testid="export-equipment-asset-register">Export asset register</Button>}
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
      <DateRangeFields startDate={fromDate} endDate={toDate} startLabel="From date" endLabel="To date" onStartDateChange={setFromDate} onEndDateChange={setToDate} />
      <Button variant="outlined" onClick={() => setPreview({ label: REPORTS.find(([id]) => id === report)?.[1] ?? "Equipment report", data: build(report) })}>Generate preview</Button>
      {canExport && <Button variant="outlined" onClick={() => exportReport(report)} data-testid="export-selected-equipment-report">Export selected report CSV</Button>}
    </Box>
    {preview && <Box sx={{ mt: 3 }} aria-live="polite">
      <Typography component="h2" variant="h6">{preview.label} preview</Typography>
      {preview.data.rows.length === 0 ? <Typography>No rows match the report filters.</Typography> :
        <TableContainer tabIndex={0} role="region" aria-label={preview.label} sx={{ maxHeight: 540, maxWidth: "100%" }}>
          <Table size="small" stickyHeader>
            <TableHead><TableRow>{preview.data.header.map(title => <TableCell key={title}>{title}</TableCell>)}</TableRow></TableHead>
            <TableBody>{preview.data.rows.map((cells, index) => <TableRow key={index}>
              {cells.map((cell, column) => <TableCell key={preview.data.header[column]} sx={{ minWidth: 100 }}>{String(cell ?? "")}</TableCell>)}
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>}
    </Box>}
  </Paper>;
}
