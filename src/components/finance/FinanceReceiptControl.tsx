import { useEffect, useState } from "react";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import { addFinanceReceipt, loadFinanceReceipts, type FinanceReceipt } from "../../services/financeReceipts";

interface Props {
  transactionId: string;
  section: string;
}

export default function FinanceReceiptControl({ transactionId, section }: Props) {
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const all = await loadFinanceReceipts(section);
      setReceipts(all.filter((item) => item.transactionId === transactionId));
    } catch (loadError) {
      console.error("Unable to load finance receipts:", loadError);
      setError("Unable to load receipts.");
    }
  };

  useEffect(() => { void refresh(); }, [section, transactionId]);

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

  return <Stack spacing={1} sx={{ mt: 1.25, alignItems: "flex-start" }}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
      <Button component="label" size="small" variant="outlined" disabled={uploading} sx={{ minHeight: 40 }}>
        {uploading ? "Uploading…" : receipts.length ? "Add receipt" : "Attach receipt"}
        <input hidden type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void upload(file); }} />
      </Button>
      {receipts.map((receipt) => <Chip key={receipt.id} component="a" clickable href={receipt.downloadUrl} target="_blank" rel="noopener noreferrer" label={receipt.fileName} variant="outlined" />)}
    </Stack>
    {receipts.length > 0 && <Typography variant="caption" color="text.secondary">{receipts.length} receipt{receipts.length === 1 ? "" : "s"} attached</Typography>}
    {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
  </Stack>;
}
