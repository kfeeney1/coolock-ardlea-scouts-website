import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import {
  createFinanceTransaction,
  createFinanceTransfer,
  loadFinanceTransactions,
  reverseFinanceTransaction,
} from "../services/financeLedger";
import {
  createFinanceReconciliation,
  loadFinanceReconciliations,
} from "../services/financeReconciliations";
import {
  DEFAULT_FINANCE_CATEGORIES,
  calculateLedgerBalanceCents,
  reconcileFinanceFloat,
  signedAmountCents,
  type FinanceReconciliationRecord,
  type FinanceTransaction,
  type FinanceTransactionType,
} from "../services/financeLedgerLogic";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Group"];

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function eurosToCents(value: string): number | null {
  const normalised = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
  const numeric = Number(normalised);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

export default function SectionCashbook() {
  const { adminProfile } = useAdminAuth();
  const isAllSectionsRole = adminProfile?.role === "admin" || adminProfile?.role === "super-admin" || adminProfile?.scoutingRole === "Group Leader" || adminProfile?.scoutingRole === "Group Treasurer";
  const sections = useMemo(() => isAllSectionsRole ? GROUP_SECTIONS : (adminProfile?.sections ?? []).filter((item) => item !== "Group"), [adminProfile, isAllSectionsRole]);
  const [section, setSection] = useState("");
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [reconciliations, setReconciliations] = useState<FinanceReconciliationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<FinanceTransactionType>("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(DEFAULT_FINANCE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(today());
  const [countedCash, setCountedCash] = useState("");
  const [reconciliationNote, setReconciliationNote] = useState("");
  const [correction, setCorrection] = useState<FinanceTransaction | null>(null);
  const [correctionDate, setCorrectionDate] = useState(today());
  const [correctionReason, setCorrectionReason] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [transferDate, setTransferDate] = useState(today());

  useEffect(() => {
    if (!section && sections.length) setSection(sections[0]);
  }, [section, sections]);

  const transferDestinations = useMemo(() => GROUP_SECTIONS.filter((item) => item !== section), [section]);

  useEffect(() => {
    if (!isAllSectionsRole) return;
    if (!transferDestinations.includes(transferTo)) setTransferTo(transferDestinations[0] ?? "");
  }, [isAllSectionsRole, transferDestinations, transferTo]);

  const refresh = async () => {
    if (!section) return;
    setLoading(true);
    setError("");
    try {
      const [nextTransactions, nextReconciliations] = await Promise.all([
        loadFinanceTransactions(section),
        loadFinanceReconciliations(section),
      ]);
      setTransactions(nextTransactions);
      setReconciliations(nextReconciliations);
    } catch (refreshError) {
      console.error("Unable to load section cashbook:", refreshError);
      setError("Unable to load this section cashbook.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [section]);

  const balanceCents = useMemo(() => calculateLedgerBalanceCents(transactions), [transactions]);
  const reversedIds = useMemo(() => new Set(transactions.map((item) => item.reversalOfTransactionId).filter(Boolean)), [transactions]);
  const countedCents = useMemo(() => eurosToCents(countedCash), [countedCash]);
  const reconciliationPreview = useMemo(() => countedCents === null ? null : reconcileFinanceFloat(transactions, countedCents), [transactions, countedCents]);

  const submit = async () => {
    const amountCents = eurosToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      setError("Enter an amount greater than zero with no more than two decimal places.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createFinanceTransaction({
        section,
        type,
        amountCents,
        category,
        description,
        transactionDate,
        sourceTransactionId: "",
        reversalOfTransactionId: "",
      });
      setAmount("");
      setDescription("");
      await refresh();
    } catch (submitError) {
      console.error("Unable to add cashbook transaction:", submitError);
      setError(submitError instanceof Error ? submitError.message : "Unable to save this transaction.");
    } finally {
      setSaving(false);
    }
  };

  const saveTransfer = async () => {
    const amountCents = eurosToCents(transferAmount);
    if (amountCents === null || amountCents <= 0) {
      setError("Enter a transfer amount greater than zero with no more than two decimal places.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createFinanceTransfer({
        fromSection: section,
        toSection: transferTo,
        amountCents,
        description: transferDescription,
        transactionDate: transferDate,
      });
      setTransferAmount("");
      setTransferDescription("");
      await refresh();
    } catch (transferError) {
      console.error("Unable to transfer section finance:", transferError);
      setError(transferError instanceof Error ? transferError.message : "Unable to save this transfer.");
    } finally {
      setSaving(false);
    }
  };

  const saveReconciliation = async () => {
    if (countedCents === null) {
      setError("Enter the physical cash counted with no more than two decimal places.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createFinanceReconciliation(section, transactions, countedCents, reconciliationNote);
      setCountedCash("");
      setReconciliationNote("");
      await refresh();
    } catch (reconciliationError) {
      console.error("Unable to reconcile section cash:", reconciliationError);
      setError(reconciliationError instanceof Error ? reconciliationError.message : "Unable to save this reconciliation.");
    } finally {
      setSaving(false);
    }
  };

  const saveCorrection = async () => {
    if (!correction) return;
    setSaving(true);
    setError("");
    try {
      await reverseFinanceTransaction(correction, correctionDate, correctionReason.trim() || undefined);
      setCorrection(null);
      setCorrectionReason("");
      setCorrectionDate(today());
      await refresh();
    } catch (correctionError) {
      console.error("Unable to correct finance transaction:", correctionError);
      setError(correctionError instanceof Error ? correctionError.message : "Unable to create the correction.");
    } finally {
      setSaving(false);
    }
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="lg">
      <LeaderDashboardHeader />
      <Stack spacing={3}>
        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>Section Cashbook</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Track section cash as an append-only ledger. Mistakes are corrected with linked reversal entries, never by rewriting history.</Typography>
          <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr auto" }, gap: 2, alignItems: "center" }}>
            <FormControl fullWidth>
              <InputLabel id="finance-section-label">Section</InputLabel>
              <Select labelId="finance-section-label" id="finance-section" label="Section" value={section} onChange={(event) => setSection(event.target.value)}>
                {sections.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <Paper variant="outlined" sx={{ px: 3, py: 2, minWidth: 190 }}>
              <Typography variant="caption" color="text.secondary">Calculated balance</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{formatEuro(balanceCents)}</Typography>
            </Paper>
          </Box>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Add transaction</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <FormControl>
              <InputLabel id="finance-type-label">Type</InputLabel>
              <Select labelId="finance-type-label" id="finance-type" label="Type" value={type} onChange={(event) => setType(event.target.value as FinanceTransactionType)}>
                <MenuItem value="opening-float">Opening float</MenuItem>
                <MenuItem value="income">Money in</MenuItem>
                <MenuItem value="expense">Expense</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Amount (€)" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <FormControl>
              <InputLabel id="finance-category-label">Category</InputLabel>
              <Select labelId="finance-category-label" id="finance-category" label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
                {DEFAULT_FINANCE_CATEGORIES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField type="date" label="Date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} sx={{ gridColumn: { md: "1 / -1" } }} />
          </Box>
          <Button variant="contained" color="success" disabled={saving || !section} onClick={() => void submit()} sx={{ mt: 2, minHeight: 44 }}>{saving ? "Saving…" : "Add transaction"}</Button>
        </Paper>

        {isAllSectionsRole && <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Transfer between sections</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>Transfers create linked money-out and money-in entries in one atomic write, so one side cannot be saved without the other.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <TextField label="From section" value={section} slotProps={{ input: { readOnly: true } }} />
            <FormControl>
              <InputLabel id="finance-transfer-to-label">To section</InputLabel>
              <Select labelId="finance-transfer-to-label" id="finance-transfer-to" label="To section" value={transferTo} onChange={(event) => setTransferTo(event.target.value)}>
                {transferDestinations.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Transfer amount (€)" inputMode="decimal" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} />
            <TextField type="date" label="Transfer date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Transfer description" value={transferDescription} onChange={(event) => setTransferDescription(event.target.value)} sx={{ gridColumn: { md: "1 / -1" } }} />
          </Box>
          <Button variant="contained" color="secondary" disabled={saving || !section || !transferTo} onClick={() => void saveTransfer()} sx={{ mt: 2, minHeight: 44 }}>{saving ? "Saving…" : "Transfer money"}</Button>
        </Paper>}

        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Cash reconciliation</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>Count the physical cash and compare it with the ledger. A difference is recorded for investigation; it does not alter the balance automatically.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <TextField label="Physical cash counted (€)" inputMode="decimal" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} />
            <TextField label="Reconciliation note" value={reconciliationNote} onChange={(event) => setReconciliationNote(event.target.value)} placeholder="Required if there is a difference" />
          </Box>
          {reconciliationPreview && <Alert severity={reconciliationPreview.balanced ? "success" : "warning"} sx={{ mt: 2 }}>
            Expected {formatEuro(reconciliationPreview.expectedBalanceCents)} · Counted {formatEuro(reconciliationPreview.countedBalanceCents)} · Difference {formatEuro(reconciliationPreview.differenceCents)}
          </Alert>}
          <Button variant="contained" color="secondary" disabled={saving || !section || countedCents === null} onClick={() => void saveReconciliation()} sx={{ mt: 2, minHeight: 44 }}>Save reconciliation</Button>
          {reconciliations.length > 0 && <Stack spacing={1} sx={{ mt: 3 }}>
            <Typography sx={{ fontWeight: 800 }}>Recent reconciliations</Typography>
            {reconciliations.slice(0, 5).map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{item.reconciledAt ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(item.reconciledAt) : "Reconciliation pending timestamp"}</Typography>
                  {item.note && <Typography variant="body2" color="text.secondary">{item.note}</Typography>}
                </Box>
                <Chip label={item.differenceCents === 0 ? "Balanced" : `Difference ${formatEuro(item.differenceCents)}`} color={item.differenceCents === 0 ? "success" : "warning"} />
              </Box>
            </Paper>)}
          </Stack>}
        </Paper>

        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Transaction history</Typography>
          {loading ? <Typography color="text.secondary">Loading cashbook…</Typography> : transactions.length === 0 ? <Alert severity="info">No cashbook transactions have been recorded for this section.</Alert> :
            <Stack spacing={1.5}>{transactions.map((transaction) => {
              const signed = signedAmountCents(transaction);
              const isAdjustment = transaction.type === "adjustment";
              const isTransfer = transaction.type === "transfer-in" || transaction.type === "transfer-out";
              const isCorrected = reversedIds.has(transaction.id);
              return <Paper key={transaction.id} variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 1.5 }}>
                  <Box>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 800 }}>{transaction.description}</Typography>
                      {isAdjustment && <Chip size="small" label="Correction" variant="outlined" />}
                      {isTransfer && <Chip size="small" label="Transfer" color="info" variant="outlined" />}
                      {isCorrected && <Chip size="small" label="Corrected" color="warning" variant="outlined" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{transaction.transactionDate} · {transaction.category} · {transaction.type}</Typography>
                    {transaction.reversalOfTransactionId && <Typography variant="caption" color="text.secondary">Reverses transaction {transaction.reversalOfTransactionId}</Typography>}
                    {isTransfer && transaction.sourceTransactionId && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Linked transfer {transaction.sourceTransactionId}</Typography>}
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
                    <Typography sx={{ fontWeight: 800 }}>{signed >= 0 ? "+" : "−"}{formatEuro(Math.abs(signed))}</Typography>
                    {!isAdjustment && !isTransfer && !isCorrected && <Button size="small" variant="outlined" color="warning" onClick={() => { setCorrection(transaction); setCorrectionReason(""); setCorrectionDate(today()); }}>Correct entry</Button>}
                  </Stack>
                </Box>
              </Paper>;
            })}</Stack>}
        </Paper>
      </Stack>

      <Dialog open={Boolean(correction)} onClose={() => !saving && setCorrection(null)} fullWidth maxWidth="sm">
        <DialogTitle>Correct cashbook entry</DialogTitle>
        <DialogContent dividers>
          {correction && <Stack spacing={2}>
            <Alert severity="warning">This does not edit or delete the original. It creates an equal and opposite adjustment linked to the original transaction.</Alert>
            <Typography><strong>Original:</strong> {correction.description} · {formatEuro(signedAmountCents(correction))}</Typography>
            <TextField type="date" label="Correction date" value={correctionDate} onChange={(event) => setCorrectionDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Reason / note" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder={`Correction of ${correction.description}`} multiline minRows={2} />
          </Stack>}
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setCorrection(null)}>Cancel</Button>
          <Button disabled={saving} variant="contained" color="warning" onClick={() => void saveCorrection()}>{saving ? "Saving…" : "Create correction"}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  </Box>;
}