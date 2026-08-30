import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { addFinanceReceipt, loadFinanceReceipts, type FinanceReceipt } from "../../services/financeReceipts";

interface Props {
  transactionId: string;
  section: string;
  refreshKey?: number;
}

export default function FinanceReceiptControl({ transactionId, section, refreshKey = 0 }: Props) {
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const all = await loadFinanceReceipts(section);
      setReceipts(all.filter((item) => item.transactionId === transactionId));
    } catch (loadError) {
      console.error("Unable to load finance receipts:", loadError);
      setError("Unable to check attached receipts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [section, transactionId, refreshKey]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await addFinanceReceipt(transactionId, section, file);
      await refresh();
    } catch (uploadError) {
      console.error("Unable to upload finance receipt:", uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload receipt.");
    } finally {
      setUploading(false);
    }
  };

  return <Stack spacing={1} sx={{ mt: 1.25, alignItems: "flex-start" }} data-testid={`finance-receipts-${transactionId}`}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
      {loading ? <Chip size="small" label="Checking receipt…" variant="outlined" /> : receipts.length > 0 ? <Chip size="small" label={receipts.length === 1 ? "Receipt attached" : `${receipts.length} receipts attached`} color="success" /> : <Chip size="small" label="No receipt attached" color="warning" variant="outlined" />}
      <Button component="label" size="small" variant="outlined" disabled={uploading || loading} sx={{ minHeight: 40 }}>
        {uploading ? "Uploading…" : receipts.length ? "Add another receipt" : "Attach receipt"}
        <input hidden type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void upload(file); }} />
      </Button>
    </Stack>

    {receipts.length > 0 && <Stack spacing={1} sx={{ width: "100%" }}>
      {receipts.map((receipt, index) => <Stack key={receipt.id} direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Button component="a" href={receipt.downloadUrl} target="_blank" rel="noopener noreferrer" size="small" variant="contained" color="secondary">
          {receipts.length === 1 ? "View receipt" : `View receipt ${index + 1}`}
        </Button>
        <Typography variant="caption" color="text.secondary">{receipt.fileName}</Typography>
        {receipt.contentType.startsWith("image/") && <Box component="a" href={receipt.downloadUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open receipt ${receipt.fileName}`} sx={{ display: "inline-flex", borderRadius: 1, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
          <Box component="img" src={receipt.downloadUrl} alt={`Receipt ${receipt.fileName}`} sx={{ width: 88, height: 88, objectFit: "cover", display: "block" }} />
        </Box>}
      </Stack>)}
    </Stack>}

    {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
  </Stack>;
}
