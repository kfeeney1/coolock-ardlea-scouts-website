import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import type { BadgeworkAwardCandidate } from "../../services/adventureSkillAwardQueueLogic.ts";

type Props = {
  candidates: readonly BadgeworkAwardCandidate[];
  awarding: boolean;
  onAwardSelected: (candidates: readonly BadgeworkAwardCandidate[]) => Promise<void>;
  onOpenStage: (memberId: string, skillId: string, stage: number) => void;
};

const candidateKey = (candidate: BadgeworkAwardCandidate) => `${candidate.memberId}-${candidate.skillId}-${candidate.stage}`;

export default function BadgeworkAwaitingAwardQueue({ candidates, awarding, onAwardSelected, onOpenStage }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const availableKeys = useMemo(() => new Set(candidates.map(candidateKey)), [candidates]);
  const selectedCandidates = useMemo(() => candidates.filter((candidate) => selectedKeys.has(candidateKey(candidate))), [candidates, selectedKeys]);
  const allSelected = candidates.length > 0 && selectedCandidates.length === candidates.length;
  const someSelected = selectedCandidates.length > 0 && !allSelected;

  useEffect(() => {
    setSelectedKeys((current) => new Set([...current].filter((key) => availableKeys.has(key))));
  }, [availableKeys]);

  if (candidates.length === 0) return <Alert severity="info">No saved badgework is currently awaiting an award in the filtered children.</Alert>;

  const toggleCandidate = (candidate: BadgeworkAwardCandidate) => {
    const key = candidateKey(candidate);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleAll = () => setSelectedKeys(allSelected ? new Set() : new Set(candidates.map(candidateKey)));

  return <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }} data-testid="badgework-awaiting-award-queue">
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 1.5 }}>
      <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Awaiting award queue</Typography><Typography variant="body2" color="text.secondary">Only stages with every saved competency point complete are listed here. Select the badges you are ready to award.</Typography></Box>
      <Button variant="contained" color="warning" disabled={awarding || selectedCandidates.length === 0} onClick={() => setConfirmOpen(true)}>Award selected · {selectedCandidates.length}</Button>
    </Stack>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5, alignItems: { sm: "center" } }}>
      <FormControlLabel control={<Checkbox checked={allSelected} indeterminate={someSelected} disabled={awarding} onChange={toggleAll} />} label={`Select all ready shown · ${candidates.length}`} />
      {selectedCandidates.length > 0 && <Button size="small" disabled={awarding} onClick={() => setSelectedKeys(new Set())}>Clear selection</Button>}
    </Stack>
    <Stack spacing={1}>
      {candidates.map((candidate) => {
        const key = candidateKey(candidate);
        return <Paper key={key} variant="outlined" sx={{ p: 1.25 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
            <FormControlLabel sx={{ m: 0, minWidth: 0 }} control={<Checkbox checked={selectedKeys.has(key)} disabled={awarding} onChange={() => toggleCandidate(candidate)} inputProps={{ "aria-label": `Select ${candidate.memberName} ${candidate.skillName} Stage ${candidate.stage} for award` }} />} label={<Box><Typography sx={{ fontWeight: 800 }}>{candidate.memberName}</Typography><Typography variant="body2" color="text.secondary">{candidate.section} · {candidate.skillName} · Stage {candidate.stage}</Typography></Box>} />
            <Button size="small" variant="outlined" disabled={awarding} onClick={() => onOpenStage(candidate.memberId, candidate.skillId, candidate.stage)}>Review stage</Button>
          </Stack>
        </Paper>;
      })}
    </Stack>
    <Dialog open={confirmOpen} onClose={awarding ? undefined : () => setConfirmOpen(false)} fullWidth maxWidth="sm" aria-labelledby="award-ready-badges-title">
      <DialogTitle id="award-ready-badges-title">Award selected ready badges?</DialogTitle>
      <DialogContent><Typography>This will create {selectedCandidates.length} stage award {selectedCandidates.length === 1 ? "record" : "records"}. Competency progress will not be changed. Only the selected stages already saved as fully complete are included.</Typography></DialogContent>
      <DialogActions><Button disabled={awarding} onClick={() => setConfirmOpen(false)}>Cancel</Button><Button color="warning" variant="contained" disabled={awarding || selectedCandidates.length === 0} onClick={() => { void onAwardSelected(selectedCandidates).then(() => { setConfirmOpen(false); setSelectedKeys(new Set()); }).catch(() => undefined); }}>{awarding ? "Awarding…" : `Award selected · ${selectedCandidates.length}`}</Button></DialogActions>
    </Dialog>
  </Paper>;
}
