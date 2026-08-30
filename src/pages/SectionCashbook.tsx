import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
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
  loadFinanceTransactions,
} from "../services/financeLedger";
import {
  DEFAULT_FINANCE_CATEGORIES,
  calculateLedgerBalanceCents,
  signedAmountCents,
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

export default function SectionCashbook() {
  const { adminProfile } = useAdminAuth();
  const isAllSectionsRole = adminProfile?.role === "admin" || adminProfile?.role === "super-admin" || adminProfile?.scoutingRole === "Group Leader" || adminProfile?.scoutingRole === "Group Treasurer";
  const sections = useMemo(() => isAllSectionsRole ? GROUP_SECTIONS : (adminProfile?.sections ?? []).filter((section) => section !== "Group"), [adminProfile, isAllSectionsRole]);
  const [section, setSection] = useState("");
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<FinanceTransactionType>("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(DEFAULT_FINANCE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(today());

  useEffect(() => {
    if (!section && sections.length) setSection(sections[0]);
  }, [section, sections]);

  const refresh = async () => {
    if (!section) return;
    setLoading(true);
    setError("");
    try {
      setTransactions(await loadFinanceTransactions(section));
    } catch (refreshError) {
      console.error("Unable to load section cashbook:", refreshError);
      setError("Unable to load this section cashbook.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [section]);

  const balanceCents = useMemo(() => calculateLedgerBalanceCents(transactions), [transactions]);

  const submit = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createFinanceTransaction({
        section,
        type,
        amountCents: Math.round(numericAmount * 100),
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

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="lg">
      <LeaderDashboardHeader />
      <Stack spacing={3}>
        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>Section Cashbook</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Track section cash as an append-only ledger. Corrections are recorded separately rather than rewriting history.</Typography>
          <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr auto" }, gap: 2, alignItems: "center" }}>
            <FormControl fullWidth>
              <InputLabel>Section</InputLabel>
              <Select label="Section" value={section} onChange={(event) => setSection(event.target.value)}>
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
              <InputLabel>Type</InputLabel>
              <Select label="Type" value={type} onChange={(event) => setType(event.target.value as FinanceTransactionType)}>
                <MenuItem value="opening-float">Opening float</MenuItem>
                <MenuItem value="income">Money in</MenuItem>
                <MenuItem value="expense">Expense</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Amount (€)" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <FormControl>
              <InputLabel>Category</InputLabel>
              <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
                {DEFAULT_FINANCE_CATEGORIES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField type="date" label="Date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} sx={{ gridColumn: { md: "1 / -1" } }} />
          </Box>
          <Button variant="contained" color="success" disabled={saving || !section} onClick={() => void submit()} sx={{ mt: 2, minHeight: 44 }}>{saving ? "Saving…" : "Add transaction"}</Button>
        </Paper>

        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Transaction history</Typography>
          {loading ? <Typography color="text.secondary">Loading cashbook…</Typography> : transactions.length === 0 ? <Alert severity="info">No cashbook transactions have been recorded for this section.</Alert> :
            <Stack spacing={1.5}>{transactions.map((transaction) => {
              const signed = signedAmountCents(transaction);
              return <Paper key={transaction.id} variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>{transaction.description}</Typography>
                    <Typography variant="body2" color="text.secondary">{transaction.transactionDate} · {transaction.category} · {transaction.type}</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 800 }}>{signed >= 0 ? "+" : "−"}{formatEuro(Math.abs(signed))}</Typography>
                </Box>
              </Paper>;
            })}</Stack>}
        </Paper>
      </Stack>
    </Container>
  </Box>;
}
