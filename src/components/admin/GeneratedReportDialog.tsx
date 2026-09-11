import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";

export type GeneratedReport = {
  filename: string;
  label: string;
  mimeType: string;
  url: string;
};

export function useGeneratedReport() {
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [open, setOpen] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const releaseCurrentUrl = useCallback(() => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  useEffect(() => () => releaseCurrentUrl(), [releaseCurrentUrl]);

  const prepareCsv = useCallback((filename: string, label: string, content: string, includeBom = false) => {
    releaseCurrentUrl();
    const blob = new Blob([includeBom ? "\uFEFF" : "", content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setReport({ filename, label, mimeType: blob.type, url });
    setOpen(true);
  }, [releaseCurrentUrl]);

  const close = useCallback(() => setOpen(false), []);
  const reopen = useCallback(() => {
    if (report) setOpen(true);
  }, [report]);

  return { report, open, prepareCsv, close, reopen };
}

function openInNewTab(url: string) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

function emailHref(report: GeneratedReport) {
  const subject = encodeURIComponent(report.label);
  const body = encodeURIComponent(`The report ${report.filename} has been generated. Download the report from the application and attach it to this email before sending.`);
  return `mailto:?subject=${subject}&body=${body}`;
}

function whatsappHref(report: GeneratedReport) {
  const text = encodeURIComponent(`The report ${report.filename} has been generated. Download the report from the application and attach it in WhatsApp before sending.`);
  return `https://wa.me/?text=${text}`;
}

type Props = {
  report: GeneratedReport | null;
  open: boolean;
  onClose: () => void;
};

export default function GeneratedReportDialog({ report, open, onClose }: Props) {
  const [sendOptionsOpen, setSendOptionsOpen] = useState(false);

  useEffect(() => {
    if (!open) setSendOptionsOpen(false);
  }, [open]);

  return (
    <Dialog open={open && Boolean(report)} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="generated-report-title">
      <DialogTitle id="generated-report-title">Report ready</DialogTitle>
      {report && <>
        <DialogContent dividers>
          <Typography><strong>{report.label}</strong> has been generated successfully.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Open it in a new tab, download the same generated file, send it using Email or WhatsApp, or keep working.
          </Typography>
          {sendOptionsOpen && <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 2 }} data-testid="report-send-options">
            <Button component="a" href={emailHref(report)} target="_blank" rel="noreferrer" variant="outlined">Email</Button>
            <Button component="a" href={whatsappHref(report)} target="_blank" rel="noreferrer" variant="outlined">WhatsApp</Button>
          </Stack>}
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1, px: 3, py: 2 }}>
          <Button onClick={() => openInNewTab(report.url)} data-testid="open-generated-report">Open report</Button>
          <Button component="a" href={report.url} download={report.filename} data-testid="download-generated-report">Download report</Button>
          <Button onClick={() => setSendOptionsOpen((current) => !current)} aria-expanded={sendOptionsOpen} aria-controls="report-send-options">Send report</Button>
          <Button variant="contained" onClick={onClose}>Keep working</Button>
        </DialogActions>
      </>}
    </Dialog>
  );
}
