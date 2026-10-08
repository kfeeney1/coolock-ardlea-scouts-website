import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import FinanceReceiptControl from "./FinanceReceiptControl";
import {
  FLOAT_CLOSE_CATEGORY,
  signedAmountCents,
  type FinanceTransaction,
} from "../../services/financeLedgerLogic";

type Props = {
  transactions: FinanceTransaction[];
  loading: boolean;
  reversedIds: Set<string>;
  receiptRefreshKey: number;
  formatEuro: (cents: number) => string;
  onCorrect: (transaction: FinanceTransaction) => void;
};

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function transactionLabel(transaction: FinanceTransaction): string {
  if (transaction.type === "opening-float") return "Open float";
  if (transaction.type === "income") return "Float top up";
  if (transaction.type === "expense" && transaction.category === FLOAT_CLOSE_CATEGORY) return "Close float";
  if (transaction.type === "expense") return "Money out";
  if (transaction.type === "adjustment") return "Correction";
  return "Legacy transfer";
}

export default function SectionCashbookHistory({
  transactions,
  loading,
  reversedIds,
  receiptRefreshKey,
  formatEuro,
  onCorrect,
}: Props) {
  return (
    <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 } }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Transaction history</Typography>
      {loading ? <Typography color="text.secondary">Loading section float…</Typography> : transactions.length === 0 ? <Alert severity="info">No float transactions have been recorded for this section.</Alert> : <Stack spacing={1.5}>{transactions.map((transaction) => {
        const signed = signedAmountCents(transaction);
        const isAdjustment = transaction.type === "adjustment";
        const isTransfer = transaction.type === "transfer-in" || transaction.type === "transfer-out";
        const isCorrected = reversedIds.has(transaction.id);
        const isReceiptEligible = transaction.type === "expense" && transaction.category !== FLOAT_CLOSE_CATEGORY;
        return <Paper key={transaction.id} data-testid={`finance-transaction-${transaction.id}`} variant="outlined" sx={{ p: 2 }}><Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 1.5 }}><Box><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><Typography sx={{ fontWeight: 800 }}>{transaction.description}</Typography><Chip size="small" label={transactionLabel(transaction)} variant="outlined" />{isCorrected && <Chip size="small" label="Corrected" color="warning" variant="outlined" />}</Stack><Typography variant="body2" color="text.secondary">{transaction.transactionDate}{transaction.type === "expense" && transaction.category !== FLOAT_CLOSE_CATEGORY ? ` · ${transaction.category}` : ""}</Typography>{isReceiptEligible && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>Entered {transaction.createdAt ? formatTimestamp(transaction.createdAt) : "timestamp pending"}</Typography>}{transaction.reversalOfTransactionId && <Typography variant="caption" color="text.secondary">Reverses transaction {transaction.reversalOfTransactionId}</Typography>}{isTransfer && transaction.sourceTransactionId && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Historical linked transfer {transaction.sourceTransactionId}</Typography>}{isReceiptEligible && <FinanceReceiptControl transactionId={transaction.id} section={transaction.section} refreshKey={receiptRefreshKey} />}</Box><Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}><Typography sx={{ fontWeight: 800 }}>{signed >= 0 ? "+" : "−"}{formatEuro(Math.abs(signed))}</Typography>{!isAdjustment && !isTransfer && !isCorrected && <Button size="small" variant="outlined" color="warning" onClick={() => onCorrect(transaction)}>Correct entry</Button>}</Stack></Box></Paper>;
      })}</Stack>}
    </Paper>
  );
}
