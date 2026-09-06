import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";

import type { BadgeworkAwardCandidate } from "../../services/adventureSkillAwardQueueLogic.ts";

type Props = {
  candidates: readonly BadgeworkAwardCandidate[];
  awarding: boolean;
  onAwardAll: () => Promise<void>;
  onOpenStage: (memberId: string, skillId: string, stage: number) => void;
};

export default function BadgeworkAwaitingAwardQueue({ candidates, awarding, onAwardAll, onOpenStage }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (candidates.length === 0) return <Alert severity="info">No saved badgework is currently awaiting an award in the filtered children.</Alert>;

  return <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }} data-testid="badgework-awaiting-award-queue">
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 1.5 }}>
      <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Awaiting award queue</Typography><Typography variant="body2" color="text.secondary">Only stages with every saved competency point complete are listed here.</Typography></Box>
      <Button variant="contained" color="warning" disabled={awarding} onClick={() => setConfirmOpen(true)}>Award all ready shown · {candidates.length}</Button>
    </Stack>
    <Stack spacing={1}>
      {candidates.map((candidate) => <Paper key={`${candidate.memberId}-${candidate.skillId}-${candidate.stage}`} variant="outlined" sx={{ p: 1.25 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
          <Box><Typography sx={{ fontWeight: 800 }}>{candidate.memberName}</Typography><Typography variant="body2" color="text.secondary">{candidate.section} · {candidate.skillName} · Stage {candidate.stage}</Typography></Box>
          <Button size="small" variant="outlined" onClick={() => onOpenStage(candidate.memberId, candidate.skillId, candidate.stage)}>Review stage</Button>
        </Stack>
      </Paper>)}
    </Stack>
    <Dialog open={confirmOpen} onClose={awarding ? undefined : () => setConfirmOpen(false)} fullWidth maxWidth="sm" aria-labelledby="award-ready-badges-title">
      <DialogTitle id="award-ready-badges-title">Award all ready badges shown?</DialogTitle>
      <DialogContent><Typography>This will create {candidates.length} stage award {candidates.length === 1 ? "record" : "records"}. Competency progress will not be changed. Only stages already saved as fully complete are included.</Typography></DialogContent>
      <DialogActions><Button disabled={awarding} onClick={() => setConfirmOpen(false)}>Cancel</Button><Button color="warning" variant="contained" disabled={awarding} onClick={() => { void onAwardAll().then(() => setConfirmOpen(false)).catch(() => undefined); }}>{awarding ? "Awarding…" : "Award all ready"}</Button></DialogActions>
    </Dialog>
  </Paper>;
}
