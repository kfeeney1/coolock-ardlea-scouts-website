import { Alert, Box, Button, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "./AdminAuthProvider";
import { recordAuditEvent } from "../../services/auditLog";
import { loadFinanceTransactions } from "../../services/financeLedger";
import { loadFinanceReceipts, type FinanceReceipt } from "../../services/financeReceipts";
import { DEFAULT_FINANCE_CATEGORIES, type FinanceTransaction } from "../../services/financeLedgerLogic";
import { buildFinanceMonthlyTotals, buildFinanceReportSummary, filterFinanceTransactions, financeReportCsv } from "../../services/financeReportingLogic";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Group"];

function euro(cents: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function FinanceReportsPanel() {
  const { adminProfile } = useAdminAuth();
  const allFinance = adminProfile?.role === "admin" || adminProfile?.role === "super-admin" || adminProfile?.scoutingRole === "Group Leader" || adminProfile?.scoutingRole === "Group Treasurer";
  const permittedSections = useMemo(() => allFinance ? GROUP_SECTIONS : (adminProfile?.sections ?? []), [adminProfile, allFinance]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);
  const [section, setSection] = useState("");
  const [category, setCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const transactionGroups = await Promise.all(permittedSections.map((item) => loadFinanceTransactions(item)));
        const receiptGroups = await Promise.all(permittedSections.map((item) => loadFinanceReceipts(item)));
        if (!cancelled) {
          setTransactions(transactionGroups.flat());
          setReceipts(receiptGroups.flat());
        }
      } catch (loadError) {
        console.error("Unable to load finance reporting data:", loadError);
        if (!cancelled) setError("Unable to load finance reporting data for your permitted sections.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [permittedSections]);

  const filtered = useMemo(() => filterFinanceTransactions(transactions, { section, category, fromDate, toDate }), [transactions, section, category, fromDate, toDate]);
  const filteredIds = useMemo(() => new Set(filtered.map((item) => item.id)), [filtered]);
  const filteredReceipts = useMemo(() => receipts.filter((receipt) => filteredIds.has(receipt.transactionId)), [receipts, filteredIds]);
  const summary = useMemo(() => buildFinanceReportSummary(filtered, filteredReceipts), [filtered, filteredReceipts]);
  const monthly = useMemo(() => buildFinanceMonthlyTotals(filtered), [filtered]);
  const categories = useMemo(() => [...new Set([...DEFAULT_FINANCE_CATEGORIES, ...transactions.map((item) => item.category)])].sort(), [transactions]);
  const missingReceiptRows = useMemo(() => {
    const receiptIds = new Set(receipts.map((receipt) => receipt.transactionId));
    return filtered.filter((item) => item.type === "expense" && !receiptIds.has(item.id));
  }, [filtered, receipts]);

  const exportCsv = () => {
    if (filtered.length === 0) return;
    downloadCsv(`finance-report-${new Date().toISOString().slice(0, 10)}.csv`, financeReportCsv(filtered, filteredReceipts));
    void recordAuditEvent({ category: "finance", action: "finance-report-exported", targetId: "finance-report", targetLabel: "Finance report", description: `Exported ${filtered.length} finance transactions with ${summary.missingReceiptCount} missing expense receipts.`, section: section || "All permitted sections" });
  };

  const printReport = () => {
    void recordAuditEvent({ category: "finance", action: "finance-report-printed", targetId: "finance-report", targetLabel: "Finance report", description: `Opened printable finance report for ${filtered.length} transactions.`, section: section || "All permitted sections" });
    window.print();
  };

  return <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }} data-testid="finance-reporting">
    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Finance reporting</Typography>
    <Typography color="text.secondary" sx={{ mt: 0.5 }}>Review ledger movement, monthly totals and missing receipts. CSV exports use the same permission-scoped data shown here.</Typography>

    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    <Box sx={{ mt: 2.5, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
      <FormControl fullWidth>
        <InputLabel id="finance-report-section-label">Section</InputLabel>
        <Select labelId="finance-report-section-label" label="Section" value={section} onChange={(event) => setSection(event.target.value)}>
          <MenuItem value="">All permitted sections</MenuItem>
          {permittedSections.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="finance-report-category-label">Category</InputLabel>
        <Select labelId="finance-report-category-label" label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <MenuItem value="">All categories</MenuItem>
          {categories.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField type="date" label="Finance from date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField type="date" label="Finance to date" value={toDate} onChange={(event) => setToDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    </Box>

    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
      <Button variant="outlined" onClick={() => { setSection(""); setCategory(""); setFromDate(""); setToDate(""); }}>Clear finance filters</Button>
      <Button variant="contained" color="success" disabled={loading || filtered.length === 0} onClick={exportCsv}>Export Finance CSV</Button>
      <Button variant="outlined" color="secondary" disabled={loading || filtered.length === 0} onClick={printReport}>Print / Save PDF</Button>
    </Stack>

    {loading ? <Typography color="text.secondary" sx={{ mt: 3 }}>Loading finance report…</Typography> : <>
      <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="overline">Income</Typography><Typography variant="h5" sx={{ fontWeight: 800 }}>{euro(summary.incomeCents)}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="overline">Expenses</Typography><Typography variant="h5" sx={{ fontWeight: 800 }}>{euro(summary.expenseCents)}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="overline">Net movement</Typography><Typography variant="h5" sx={{ fontWeight: 800 }}>{euro(summary.netMovementCents)}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="overline">Missing receipts</Typography><Typography variant="h5" sx={{ fontWeight: 800 }}>{summary.missingReceiptCount}</Typography><Typography variant="body2" color="text.secondary">of {summary.expenseCount} expenses</Typography></Paper>
      </Box>

      <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>Monthly totals</Typography>
          {monthly.length === 0 ? <Typography color="text.secondary">No transactions match these filters.</Typography> : <Stack spacing={1}>{monthly.map((item) => <Box key={item.month} sx={{ display: "grid", gridTemplateColumns: "1fr repeat(3, auto)", gap: 2, alignItems: "center" }}>
            <Typography sx={{ fontWeight: 700 }}>{item.month}</Typography>
            <Typography variant="body2">In {euro(item.incomeCents)}</Typography>
            <Typography variant="body2">Out {euro(item.expenseCents)}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Net {euro(item.netCents)}</Typography>
          </Box>)}</Stack>}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 800 }}>Receipt completeness</Typography>
          {missingReceiptRows.length === 0 ? <Alert severity="success" sx={{ mt: 1.5 }}>All filtered expense entries have at least one receipt attached.</Alert> : <>
            <Alert severity="warning" sx={{ mt: 1.5 }}>{missingReceiptRows.length} filtered expense entr{missingReceiptRows.length === 1 ? "y is" : "ies are"} missing a receipt.</Alert>
            <Stack spacing={0.75} sx={{ mt: 1.5 }}>{missingReceiptRows.slice(0, 8).map((item) => <Typography key={item.id} variant="body2">{item.transactionDate} · {item.section} · {item.description} · {euro(item.amountCents)}</Typography>)}</Stack>
            {missingReceiptRows.length > 8 && <Typography variant="caption" color="text.secondary">Plus {missingReceiptRows.length - 8} more in the CSV export.</Typography>}
          </>}
        </Paper>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{filtered.length} transaction{filtered.length === 1 ? "" : "s"} in the current finance report. Internal transfers are shown as linked ledger movement; across all sections their in/out values cancel in net movement.</Typography>
    </>}
  </Paper>;
}
