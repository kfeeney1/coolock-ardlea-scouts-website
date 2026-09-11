import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from "@mui/material";
import { useEffect, useRef, useState } from "react";

export type GeneratedReport = {
  filename: string;
  label: string;
  mimeType: string;
  url: string;
};

function reportLabel(filename: string) {
  return filename
    .replace(/\.csv$/i, "")
    .replace(/-\d{4}-\d{2}-\d{2}$/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function openInNewTab(url: string) {
  const opened = window.open("about:blank", "_blank");
  if (!opened) return;
  opened.opener = null;
  opened.location.replace(url);
}

function emailHref(report: GeneratedReport) {
  const subject = encodeURIComponent(report.label);
  const body = encodeURIComponent(`The report ${report.filename} is ready. Download it from the Scout website and attach it to this email before sending.`);
  return `mailto:?subject=${subject}&body=${body}`;
}

function whatsappHref(report: GeneratedReport) {
  const text = encodeURIComponent(`The report ${report.filename} is ready. Download it from the Scout website and attach it in WhatsApp before sending.`);
  return `https://wa.me/?text=${text}`;
}

type Props = {
  report: GeneratedReport | null;
  open: boolean;
  onClose: () => void;
};

export function GeneratedReportDialog({ report, open, onClose }: Props) {
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
          {sendOptionsOpen && <Stack id="report-send-options" direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 2 }} data-testid="report-send-options">
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

export default function ReportDownloadExperience() {
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [open, setOpen] = useState(false);
  const ownedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
    const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    const generatedBlobs = new Map<string, Blob>();
    const currentCreateObjectURL = URL.createObjectURL;
    const currentRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = ((object: Blob | MediaSource) => {
      const url = nativeCreateObjectURL(object);
      if (object instanceof Blob) generatedBlobs.set(url, object);
      return url;
    }) as typeof URL.createObjectURL;

    URL.revokeObjectURL = ((url: string) => {
      generatedBlobs.delete(url);
      nativeRevokeObjectURL(url);
    }) as typeof URL.revokeObjectURL;

    const handleDownloadClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[download]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const path = window.location.pathname;
      if (path !== "/leader/reports" && path !== "/leader/equipment") return;
      const filename = link.download;
      if (!filename.toLowerCase().endsWith(".csv")) return;
      const blob = generatedBlobs.get(link.href);
      if (!blob || !blob.type.toLowerCase().startsWith("text/csv")) return;

      event.preventDefault();
      event.stopPropagation();

      if (ownedUrlRef.current) nativeRevokeObjectURL(ownedUrlRef.current);
      const retainedUrl = nativeCreateObjectURL(blob);
      ownedUrlRef.current = retainedUrl;
      setReport({ filename, label: reportLabel(filename), mimeType: blob.type, url: retainedUrl });
      setOpen(true);
    };

    document.addEventListener("click", handleDownloadClick, true);
    return () => {
      document.removeEventListener("click", handleDownloadClick, true);
      URL.createObjectURL = currentCreateObjectURL;
      URL.revokeObjectURL = currentRevokeObjectURL;
      if (ownedUrlRef.current) nativeRevokeObjectURL(ownedUrlRef.current);
      ownedUrlRef.current = null;
      generatedBlobs.clear();
    };
  }, []);

  return <GeneratedReportDialog report={report} open={open} onClose={() => setOpen(false)} />;
}
