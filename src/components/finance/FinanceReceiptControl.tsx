import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import {
  addFinanceReceipt,
  loadFinanceReceipts,
  removeFinanceReceipt,
  revokeFinanceReceiptUrls,
  type FinanceReceipt,
} from "../../services/financeReceipts";

interface Props {
  transactionId: string;
  section: string;
  refreshKey?: number;
}

const RECEIPT_CHECK_TIMEOUT_MS = 8000;

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

export default function FinanceReceiptControl({ transactionId, section, refreshKey = 0 }: Props) {
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const [receiptToRemove, setReceiptToRemove] = useState<FinanceReceipt | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const all = await withTimeout(loadFinanceReceipts(section), RECEIPT_CHECK_TIMEOUT_MS, "Receipt check timed out.");
      const matching = all.filter((item) => item.transactionId === transactionId);
      revokeFinanceReceiptUrls(all.filter((item) => item.transactionId !== transactionId));
      setReceipts((current) => {
        revokeFinanceReceiptUrls(current);
        return matching;
      });
    } catch (loadError) {
      console.error("Unable to load finance receipts:", loadError);
      setError("Receipt storage is unavailable right now. You can retry the check or attach a receipt once Storage is available.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    return () => setReceipts((current) => {
      revokeFinanceReceiptUrls(current);
      return [];
    });
  }, [section, transactionId, refreshKey]);

  const upload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setFailedFile(null);
    setError("");
    try {
      await addFinanceReceipt(transactionId, section, file, ({ bytesTransferred, totalBytes }) => {
        setUploadProgress(totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : null);
      });
      setUploadProgress(100);
      await refresh();
    } catch (uploadError) {
      console.error("Unable to upload finance receipt:", uploadError);
      setFailedFile(file);
      setError("Receipt upload failed. The payment record remains unchanged; you can retry this receipt without reloading the page.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!receiptToRemove) return;
    setRemoving(true);
    setError("");
    try {
      await removeFinanceReceipt(receiptToRemove);
      setReceiptToRemove(null);
      await refresh();
    } catch (removeError) {
      console.error("Unable to remove finance receipt:", removeError);
      setError("Receipt removal failed. The payment record and receipt have not been changed; please retry.");
    } finally {
      setRemoving(false);
    }
  };

  const uploadStatus = uploading
    ? uploadProgress === null
      ? "Uploading receipt…"
      : `Uploading receipt… ${uploadProgress}%`
    : uploadProgress === 100
      ? "Receipt upload complete"
      : "";

  return <Stack spacing={1} sx={{ mt: 1.25, alignItems: "flex-start" }} data-testid={`finance-receipts-${transactionId}`}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
      {loading ? <Chip size="small" label="Checking receipt…" variant="outlined" /> : receipts.length > 0 ? <Chip size="small" label={receipts.length === 1 ? "Receipt attached" : `${receipts.length} receipts attached`} color="success" /> : error ? <Chip size="small" label="Receipt status unavailable" color="error" variant="outlined" /> : <Chip size="small" label="No receipt attached" color="warning" variant="outlined" />}
      <Button component="label" size="small" variant="outlined" disabled={uploading || loading || removing} sx={{ minHeight: 40 }}>
        {uploading ? "Uploading…" : receipts.length ? "Add another receipt" : "Attach receipt"}
        <input hidden type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; event.currentTarget.value = ""; void upload(file); }} />
      </Button>
      {failedFile && !uploading && <Button size="small" variant="text" onClick={() => void upload(failedFile)} disabled={loading || removing}>Retry upload</Button>}
      {!loading && error && !failedFile && <Button size="small" variant="text" onClick={() => void refresh()} disabled={uploading || removing}>Retry receipt check</Button>}
    </Stack>

    {uploadStatus && <Box sx={{ width: "100%", maxWidth: 360 }} role="status" aria-live="polite">
      <Typography variant="caption">{uploadStatus}</Typography>
      {uploading && <LinearProgress variant={uploadProgress === null ? "indeterminate" : "determinate"} value={uploadProgress ?? undefined} aria-label="Receipt upload progress" />}
    </Box>}

    {receipts.length > 0 && <Stack spacing={1} sx={{ width: "100%" }}>
      {receipts.map((receipt, index) => <Stack key={receipt.id} direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Button component="a" href={receipt.viewUrl} target="_blank" rel="noopener noreferrer" size="small" variant="contained" color="secondary">
          {receipts.length === 1 ? "View receipt" : `View receipt ${index + 1}`}
        </Button>
        <Typography variant="caption" color="text.secondary">{receipt.fileName}</Typography>
        <Button size="small" color="error" variant="text" onClick={() => setReceiptToRemove(receipt)} disabled={uploading || removing} aria-label={`Remove receipt ${receipt.fileName}`}>
          Remove receipt
        </Button>
        {receipt.contentType.startsWith("image/") && <Box component="a" href={receipt.viewUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open receipt ${receipt.fileName}`} sx={{ display: "inline-flex", borderRadius: 1, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
          <Box component="img" src={receipt.viewUrl} alt={`Receipt ${receipt.fileName}`} sx={{ width: 88, height: 88, objectFit: "cover", display: "block" }} />
        </Box>}
      </Stack>)}
    </Stack>}

    {error && <Alert severity="error" sx={{ py: 0 }} role="alert">{error}</Alert>}

    <Dialog open={receiptToRemove !== null} onClose={() => { if (!removing) setReceiptToRemove(null); }} aria-labelledby="remove-receipt-title">
      <DialogTitle id="remove-receipt-title">Remove receipt?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This removes the uploaded receipt attachment{receiptToRemove?.fileName ? ` “${receiptToRemove.fileName}”` : ""}. The payment record will remain.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setReceiptToRemove(null)} disabled={removing}>Cancel</Button>
        <Button onClick={() => void remove()} color="error" variant="contained" disabled={removing}>{removing ? "Removing…" : "Remove receipt"}</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
