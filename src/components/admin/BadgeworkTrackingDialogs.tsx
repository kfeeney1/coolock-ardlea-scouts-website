import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

type Props = {
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
    <Dialog open={pendingDiscard} onClose={onKeepEditing} aria-labelledby="discard-badgework-title" fullWidth maxWidth="sm">
      <DialogTitle id="discard-badgework-title">Discard unsaved badgework changes?</DialogTitle>
      <DialogContent>
        <Typography>You have {unsavedChangeCount} unsaved badgework {unsavedChangeCount === 1 ? "change" : "changes"}. Continuing will discard those draft selections without writing them to any member record.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onKeepEditing}>Keep editing</Button>
        <Button color="warning" variant="contained" onClick={onConfirmDiscard}>Discard and continue</Button>
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
