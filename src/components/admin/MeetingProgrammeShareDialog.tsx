import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
type Props = { open: boolean; busy: boolean; url: string; error: string; close: () => void; start: () => Promise<void> };
export default function MeetingProgrammeShareDialog(p: Props) {
  return <Dialog open={p.open} onClose={p.busy ? undefined : p.close} aria-labelledby="meeting-share-title" fullWidth maxWidth="sm">
    <DialogTitle id="meeting-share-title">Share programme</DialogTitle>
    <DialogContent aria-busy={p.busy}>
      {p.busy && <Typography role="status">Saving meeting and preparing programme…</Typography>}
      {p.error && <Alert severity="error">{p.error}</Alert>}
      {!p.busy && p.url && <><Alert severity="success" role="status">Latest changes saved. Programme ready to share.</Alert><Typography sx={{ mt: 2, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }} data-testid="saved-programme-preview">{new URL(p.url).searchParams.get("text")}</Typography></>}
    </DialogContent>
    <DialogActions sx={{ flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44 } }}>
      <Button autoFocus disabled={p.busy} onClick={p.close}>Close</Button>
      {p.error && <Button disabled={p.busy} onClick={() => void p.start()}>Retry share</Button>}
      {!p.busy && p.url && <Button component="a" href={p.url} target="_blank" rel="noopener noreferrer" variant="contained" color="success">Share in WhatsApp</Button>}
    </DialogActions>
  </Dialog>;
}
