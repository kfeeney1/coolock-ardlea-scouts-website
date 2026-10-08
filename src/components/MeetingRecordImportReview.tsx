import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import type { MeetingCandidate, MeetingCandidateKey } from "../services/meetingRecordImport";

type Props = {
  message: string;
  warnings: string[];
  candidates: MeetingCandidate[];
  acceptedCandidates: Set<MeetingCandidateKey>;
  currentCandidateValue: (key: MeetingCandidateKey) => string;
  proposedCandidateValue: (candidate: MeetingCandidate) => string;
  onCandidateChange: (key: MeetingCandidateKey, value: string) => void;
  onToggleCandidate: (key: MeetingCandidateKey) => void;
  onApplyCandidates: () => void;
};

export default function MeetingRecordImportReview({
  message,
  warnings,
  candidates,
  acceptedCandidates,
  currentCandidateValue,
  proposedCandidateValue,
  onCandidateChange,
  onToggleCandidate,
  onApplyCandidates
}: Props) {
  return <>
    {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
    {warnings.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Check the imported draft</Typography>
      {warnings.map((warning) => <Typography key={warning} variant="body2">• {warning}</Typography>)}
    </Alert>}
    {candidates.length > 0 && <Paper variant="outlined" sx={{ p: 2, mb: 2 }} data-testid="meeting-document-preview">
      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Review document suggestions</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Existing populated values are preserved unless you explicitly select their replacement.</Typography>
      <Stack spacing={1.5}>
        {candidates.map((candidate) => {
          const existing = currentCandidateValue(candidate.key);
          const proposed = proposedCandidateValue(candidate);
          const conflict = Boolean(existing.trim()) && existing.trim() !== proposed.trim();
          const selected = acceptedCandidates.has(candidate.key);
          return <Paper key={candidate.key} variant="outlined" sx={{ p: 1.5 }} data-testid={`meeting-import-candidate-${candidate.key}`}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
              <Box sx={{ minWidth: { md: 180 } }}><Typography sx={{ fontWeight: 700 }}>{candidate.label}</Typography>{conflict && <Typography variant="caption" color="warning.main">Differs from existing value</Typography>}</Box>
              <TextField label="Existing value" value={existing} size="small" multiline disabled sx={{ flex: 1 }} />
              <TextField label="Proposed value" value={proposed} size="small" multiline sx={{ flex: 1 }} onChange={(event) => onCandidateChange(candidate.key, event.target.value)} />
              <Button variant={selected ? "contained" : "outlined"} onClick={() => onToggleCandidate(candidate.key)}>{selected ? "Selected" : "Use value"}</Button>
            </Stack>
          </Paper>;
        })}
      </Stack>
      <Button sx={{ mt: 2 }} variant="contained" disabled={acceptedCandidates.size === 0} onClick={onApplyCandidates}>Apply selected values</Button>
    </Paper>}
  </>;
}
