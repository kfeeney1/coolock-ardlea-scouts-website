import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

type Props = {
  awardConfirmationOpen?: boolean;
  onCancelAward?: () => void;
  onConfirmAward?: () => void;
  pendingDiscard: boolean;
  unsavedChangeCount: number;
  onKeepEditing: () => void;
  onConfirmDiscard: () => void;
  awardRemovalOpen: boolean;
  saving: boolean;
  stageNumber?: number;
  skillName?: string;
  selectedMemberCount: number;
  onCancelAwardRemoval: () => void;
  onConfirmAwardRemoval: () => void;
};

export default function BadgeworkTrackingDialogs({
  awardConfirmationOpen = false, onCancelAward, onConfirmAward,
  pendingDiscard,
  unsavedChangeCount,
  onKeepEditing,
  onConfirmDiscard,
  awardRemovalOpen,
  saving,
  stageNumber,
  skillName,
  selectedMemberCount,
  onCancelAwardRemoval,
  onConfirmAwardRemoval
}: Props) {
  return <>
    <Dialog open={awardConfirmationOpen} onClose={saving ? undefined : onCancelAward} aria-labelledby="confirm-stage-award-title" fullWidth maxWidth="sm">
      <DialogTitle id="confirm-stage-award-title">Award stage badge?</DialogTitle>
      <DialogContent><Typography>Award {skillName} Stage {stageNumber} to {selectedMemberCount} selected {selectedMemberCount === 1 ? "child" : "children"}? This creates award records for saved completion. Competency progress stays unchanged.</Typography></DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44 } }}><Button disabled={saving} onClick={onCancelAward}>Cancel</Button><Button variant="contained" color="success" disabled={saving} onClick={onConfirmAward}>Confirm award</Button></DialogActions>
    </Dialog>

    <Dialog open={pendingDiscard} onClose={saving ? undefined : onKeepEditing} aria-labelledby="discard-badgework-title" fullWidth maxWidth="sm">
      <DialogTitle id="discard-badgework-title">Discard unsaved badgework changes?</DialogTitle>
      <DialogContent>
        <Typography>You have {unsavedChangeCount} unsaved badgework {unsavedChangeCount === 1 ? "change" : "changes"}. Continuing will discard those draft selections without writing them to any member record.</Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onKeepEditing}>Keep editing</Button>
        <Button disabled={saving} color="warning" variant="contained" onClick={onConfirmDiscard}>Discard and continue</Button>
      </DialogActions>
    </Dialog>

    <Dialog open={awardRemovalOpen} onClose={saving ? undefined : onCancelAwardRemoval} aria-labelledby="remove-badge-award-title" fullWidth maxWidth="sm">
      <DialogTitle id="remove-badge-award-title">Remove stage award?</DialogTitle>
      <DialogContent>
        <Typography>Remove the Stage {stageNumber} {skillName} award for the selected {selectedMemberCount === 1 ? "child" : `${selectedMemberCount} children`}? Saved competency progress will remain unchanged.</Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onCancelAwardRemoval}>Cancel</Button>
        <Button color="warning" variant="contained" disabled={saving} onClick={onConfirmAwardRemoval}>Remove award</Button>
      </DialogActions>
    </Dialog>
  </>;
}
