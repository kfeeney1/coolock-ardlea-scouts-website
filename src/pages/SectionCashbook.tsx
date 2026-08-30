import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography,
} from "@mui/material";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import FinanceReceiptControl from "../components/finance/FinanceReceiptControl";
import { addFinanceReceipt } from "../services/financeReceipts";
import { createFinanceTransaction, loadFinanceTransactions, reverseFinanceTransaction } from "../services/financeLedger";
import { createFinanceReconciliation, loadFinanceReconciliations } from "../services/financeReconciliations";
import {
  DEFAULT_FINANCE_CATEGORIES,
  FLOAT_CLOSE_CATEGORY,
  FLOAT_OPEN_CATEGORY,
  FLOAT_TOP_UP_CATEGORY,
  calculateLedgerBalanceCents,
  reconcileFinanceFloat,
  signedAmountCents,
  type FinanceReconciliationRecord,
  type FinanceTransaction,
  type FinanceTransactionType,
} from "../services/financeLedgerLogic";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Group"];
const RECEIPT_UPLOAD_TIMEOUT_MS = 15000;
type FloatAction = "opening-float" | "float-top-up" | "money-out" | "close-float";

const formatEuro = (cents: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
const today = () => new Date().toISOString().slice(0, 10);
function eurosToCents(value: string): number | null {
  const normalised = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
  const numeric = Number(normalised);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

function currencyInputValue(value: string): string | null {
  const normalised = value.replace(",", ".");
  if (normalised === "" || /^\d+(\.\d{0,2})?$/.test(normalised)) return normalised;
  return null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function transactionLabel(transaction: FinanceTransaction): string {
  if (transaction.type === "opening-float") return "Open float";
  if (transaction.type === "income") return "Float top up";
  if (transaction.type === "expense" && transaction.category === FLOAT_CLOSE_CATEGORY) return "Close float";
  if (transaction.type === "expense") return "Money out";
  if (transaction.type === "adjustment") return "Correction";
  return "Legacy transfer";
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
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<FloatAction>("money-out");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(DEFAULT_FINANCE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(today());
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [countedCash, setCountedCash] = useState("");
  const [reconciliationNote, setReconciliationNote] = useState("");
  const [correction, setCorrection] = useState<FinanceTransaction | null>(null);
  const [correctionDate, setCorrectionDate] = useState(today());
  const [correctionReason, setCorrectionReason] = useState("");

  useEffect(() => { if (!section && sections.length) setSection(sections[0]); }, [section, sections]);

  const refresh = async () => {
    if (!section) return;
    setLoading(true); setError("");
    try {
      const [nextTransactions, nextReconciliations] = await Promise.all([loadFinanceTransactions(section), loadFinanceReconciliations(section)]);
      setTransactions(nextTransactions); setReconciliations(nextReconciliations);
    } catch (refreshError) {
      console.error("Unable to load section floats:", refreshError); setError("Unable to load this section float.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [section]);

  const balanceCents = useMemo(() => calculateLedgerBalanceCents(transactions), [transactions]);
  const reversedIds = useMemo(() => new Set(transactions.map((item) => item.reversalOfTransactionId).filter(Boolean)), [transactions]);
  const countedCents = useMemo(() => eurosToCents(countedCash), [countedCash]);
  const reconciliationPreview = useMemo(() => countedCents === null ? null : reconcileFinanceFloat(transactions, countedCents), [transactions, countedCents]);
  const isMoneyOut = type === "money-out";
  const isCloseFloat = type === "close-float";
  const enteredAmountCents = useMemo(() => isCloseFloat ? balanceCents : eurosToCents(amount), [amount, balanceCents, isCloseFloat]);

  useEffect(() => {
    setReceiptFile(null);
    if (type !== "money-out") setCategory(DEFAULT_FINANCE_CATEGORIES[0]);
  }, [type]);

  const submit = async () => {
    const amountCents = enteredAmountCents;
    if (amountCents === null || amountCents <= 0) {
      setError(isCloseFloat ? "There is no float balance to close." : "Enter an amount greater than zero with no more than two decimal places.");
      return;
    }
    if (type === "opening-float" && balanceCents > 0) { setError("Close the current float before opening another one."); return; }
    if (type === "money-out" && amountCents > balanceCents) { setError("Money out cannot be greater than the current section float."); return; }
    if (type === "money-out" && !description.trim()) { setError("Enter what the money was spent on."); return; }

    const storedType: FinanceTransactionType = type === "opening-float" ? "opening-float" : type === "float-top-up" ? "income" : "expense";
    const storedCategory = type === "opening-float" ? FLOAT_OPEN_CATEGORY : type === "float-top-up" ? FLOAT_TOP_UP_CATEGORY : type === "close-float" ? FLOAT_CLOSE_CATEGORY : category;
    const storedDescription = description.trim() || (type === "opening-float" ? "Open float" : type === "float-top-up" ? "Float top up" : "Close float");
    const selectedReceipt = type === "money-out" ? receiptFile : null;

    setSaving(true); setError("");
    let transactionId = "";
    try {
      transactionId = await createFinanceTransaction({ section, type: storedType, amountCents, category: storedCategory, description: storedDescription, transactionDate, sourceTransactionId: "", reversalOfTransactionId: "" });
      setAmount("");
      setDescription("");
      await refresh();
    } catch (submitError) {
      console.error("Unable to add section float transaction:", submitError);
      setError(submitError instanceof Error ? submitError.message : "Unable to save this transaction.");
      return;
    } finally {
      setSaving(false);
    }

    if (!selectedReceipt || !transactionId) {
      setReceiptFile(null);
      return;
    }

    setUploadingReceipt(true);
    try {
      await withTimeout(
        addFinanceReceipt(transactionId, section, selectedReceipt),
        RECEIPT_UPLOAD_TIMEOUT_MS,
        "Receipt upload timed out."
      );
      setReceiptFile(null);
    } catch (receiptError) {
      console.error("Money out saved but receipt upload failed:", receiptError);
      setError("Money out was saved, but the receipt did not finish uploading. Attach it from Transaction history below.");
      setReceiptFile(null);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const saveReconciliation = async () => {
    if (countedCents === null) { setError("Enter the physical cash counted with no more than two decimal places."); return; }
    setSaving(true); setError("");
    try { await createFinanceReconciliation(section, transactions, countedCents, reconciliationNote); setCountedCash(""); setReconciliationNote(""); await refresh(); }
    catch (reconciliationError) { console.error("Unable to reconcile section float:", reconciliationError); setError(reconciliationError instanceof Error ? reconciliationError.message : "Unable to save this reconciliation."); }
    finally { setSaving(false); }
  };

  const saveCorrection = async () => {
    if (!correction) return;
    setSaving(true); setError("");
    try { await reverseFinanceTransaction(correction, correctionDate, correctionReason.trim() || undefined); setCorrection(null); setCorrectionReason(""); setCorrectionDate(today()); await refresh(); }
    catch (correctionError) { console.error("Unable to correct finance transaction:", correctionError); setError(correctionError instanceof Error ? correctionError.message : "Unable to create the correction."); }
    finally { setSaving(false); }
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="lg">
      <LeaderDashboardHeader />
      <Stack spacing={3}>
        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>Section Floats</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Track only the physical section float: open it, top it up, record money out, and close it. The float can never go below €0.00.</Typography>
          <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr auto" }, gap: 2, alignItems: "center" }}>
            <FormControl fullWidth><InputLabel id="finance-section-label">Section</InputLabel><Select labelId="finance-section-label" id="finance-section" label="Section" value={section} onChange={(event) => setSection(event.target.value)}>{sections.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
            <Paper variant="outlined" sx={{ px: 3, py: 2, minWidth: 190 }}><Typography variant="caption" color="text.secondary">Current float</Typography><Typography variant="h5" sx={{ fontWeight: 800 }}>{formatEuro(balanceCents)}</Typography></Paper>
          </Box>
        </Paper>
        {error && <Alert severity="error">{error}</Alert>}

        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Float transaction</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <FormControl><InputLabel id="finance-type-label">Transaction</InputLabel><Select labelId="finance-type-label" id="finance-type" label="Transaction" value={type} onChange={(event) => setType(event.target.value as FloatAction)}><MenuItem value="opening-float">Open float</MenuItem><MenuItem value="float-top-up">Float top up</MenuItem><MenuItem value="money-out">Money out</MenuItem><MenuItem value="close-float">Close float</MenuItem></Select></FormControl>
            <TextField
              label="Amount (€)"
              value={isCloseFloat ? (balanceCents / 100).toFixed(2) : amount}
              onChange={(event) => {
                const next = currencyInputValue(event.target.value);
                if (next !== null) setAmount(next);
              }}
              disabled={isCloseFloat}
              helperText={isCloseFloat ? "Closing the float removes the full remaining balance." : "Maximum two decimal places."}
              slotProps={{ htmlInput: { inputMode: "decimal", pattern: "[0-9]*[.,]?[0-9]{0,2}" } }}
            />
            {isMoneyOut && <FormControl><InputLabel id="finance-category-label">Outgoing category</InputLabel><Select labelId="finance-category-label" id="finance-category" label="Outgoing category" value={category} onChange={(event) => setCategory(event.target.value)}>{DEFAULT_FINANCE_CATEGORIES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>}
            <TextField type="date" label="Date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label={isMoneyOut ? "What was the money spent on?" : "Note (optional)"} value={description} onChange={(event) => setDescription(event.target.value)} sx={{ gridColumn: { md: "1 / -1" } }} />
          </Box>
          {isMoneyOut && <Stack spacing={0.75} sx={{ mt: 2, alignItems: "flex-start" }}>
            <Typography sx={{ fontWeight: 700 }}>Receipt</Typography>
            <Button component="label" variant="outlined" disabled={saving || uploadingReceipt} sx={{ minHeight: 44 }}>
              {receiptFile ? "Change receipt" : "Attach receipt"}
              <input hidden type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={(event) => { setReceiptFile(event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ""; }} />
            </Button>
            <Typography variant="caption" color="text.secondary">{receiptFile ? receiptFile.name : "Optional now; a receipt can also be attached later from Transaction history."}</Typography>
          </Stack>}
          <Button variant="contained" color="success" disabled={saving || uploadingReceipt || !section || (isCloseFloat && balanceCents <= 0)} onClick={() => void submit()} sx={{ mt: 2, minHeight: 44 }}>{uploadingReceipt ? "Uploading receipt…" : saving ? "Saving…" : type === "close-float" ? "Close float" : "Save transaction"}</Button>
        </Paper>

        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Float reconciliation</Typography><Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>Count the physical float and compare it with the calculated balance. A difference is recorded for investigation; it does not alter the float automatically.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}><TextField label="Physical float counted (€)" inputMode="decimal" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} /><TextField label="Reconciliation note" value={reconciliationNote} onChange={(event) => setReconciliationNote(event.target.value)} placeholder="Required if there is a difference" /></Box>
          {reconciliationPreview && <Alert severity={reconciliationPreview.balanced ? "success" : "warning"} sx={{ mt: 2 }}>Expected {formatEuro(reconciliationPreview.expectedBalanceCents)} · Counted {formatEuro(reconciliationPreview.countedBalanceCents)} · Difference {formatEuro(reconciliationPreview.differenceCents)}</Alert>}
          <Button variant="contained" color="secondary" disabled={saving || !section || countedCents === null} onClick={() => void saveReconciliation()} sx={{ mt: 2, minHeight: 44 }}>Save reconciliation</Button>
          {reconciliations.length > 0 && <Stack spacing={1} sx={{ mt: 3 }}><Typography sx={{ fontWeight: 800 }}>Recent reconciliations</Typography>{reconciliations.slice(0, 5).map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}><Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 1 }}><Box><Typography sx={{ fontWeight: 700 }}>{item.reconciledAt ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(item.reconciledAt) : "Reconciliation pending timestamp"}</Typography>{item.note && <Typography variant="body2" color="text.secondary">{item.note}</Typography>}</Box><Chip label={item.differenceCents === 0 ? "Balanced" : `Difference ${formatEuro(item.differenceCents)}`} color={item.differenceCents === 0 ? "success" : "warning"} /></Box></Paper>)}</Stack>}
        </Paper>

        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Transaction history</Typography>
          {loading ? <Typography color="text.secondary">Loading section float…</Typography> : transactions.length === 0 ? <Alert severity="info">No float transactions have been recorded for this section.</Alert> : <Stack spacing={1.5}>{transactions.map((transaction) => {
            const signed = signedAmountCents(transaction); const isAdjustment = transaction.type === "adjustment"; const isTransfer = transaction.type === "transfer-in" || transaction.type === "transfer-out"; const isCorrected = reversedIds.has(transaction.id); const isReceiptEligible = transaction.type === "expense" && transaction.category !== FLOAT_CLOSE_CATEGORY;
            return <Paper key={transaction.id} variant="outlined" sx={{ p: 2 }}><Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 1.5 }}><Box><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><Typography sx={{ fontWeight: 800 }}>{transaction.description}</Typography><Chip size="small" label={transactionLabel(transaction)} variant="outlined" />{isCorrected && <Chip size="small" label="Corrected" color="warning" variant="outlined" />}</Stack><Typography variant="body2" color="text.secondary">{transaction.transactionDate}{transaction.type === "expense" && transaction.category !== FLOAT_CLOSE_CATEGORY ? ` · ${transaction.category}` : ""}</Typography>{transaction.reversalOfTransactionId && <Typography variant="caption" color="text.secondary">Reverses transaction {transaction.reversalOfTransactionId}</Typography>}{isTransfer && transaction.sourceTransactionId && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Historical linked transfer {transaction.sourceTransactionId}</Typography>}{isReceiptEligible && <FinanceReceiptControl transactionId={transaction.id} section={transaction.section} />}</Box><Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}><Typography sx={{ fontWeight: 800 }}>{signed >= 0 ? "+" : "−"}{formatEuro(Math.abs(signed))}</Typography>{!isAdjustment && !isTransfer && !isCorrected && <Button size="small" variant="outlined" color="warning" onClick={() => { setCorrection(transaction); setCorrectionReason(""); setCorrectionDate(today()); }}>Correct entry</Button>}</Stack></Box></Paper>;
          })}</Stack>}
        </Paper>
      </Stack>
      <Dialog open={Boolean(correction)} onClose={() => !saving && setCorrection(null)} fullWidth maxWidth="sm"><DialogTitle>Correct float entry</DialogTitle><DialogContent dividers>{correction && <Stack spacing={2}><Alert severity="warning">This does not edit or delete the original. It creates an equal and opposite correction linked to the original transaction. A correction that would take the float below €0.00 is blocked.</Alert><Typography><strong>Original:</strong> {correction.description} · {formatEuro(signedAmountCents(correction))}</Typography><TextField type="date" label="Correction date" value={correctionDate} onChange={(event) => setCorrectionDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField label="Reason / note" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder={`Correction of ${correction.description}`} multiline minRows={2} /></Stack>}</DialogContent><DialogActions><Button disabled={saving} onClick={() => setCorrection(null)}>Cancel</Button><Button disabled={saving} variant="contained" color="warning" onClick={() => void saveCorrection()}>{saving ? "Saving…" : "Create correction"}</Button></DialogActions></Dialog>
    </Container>
  </Box>;
}