import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { useConfirmEventLeave } from "../../hooks/useConfirmEventLeave";

type Props = { dirty: boolean; saving: boolean; save: () => Promise<boolean> };

/** This navigation alert owns its Back entry; the transient-dialog bridge must not add another. */
export default function BadgeworkLeaveGuard({ dirty, saving, save }: Props) {
  const leave = useConfirmEventLeave(dirty, save, undefined, true);
  return <Dialog open={leave.dialogOpen} onClose={saving ? undefined : leave.stay} aria-labelledby="leave-badgework-title" slotProps={{ paper: { role: "alertdialog" } }} fullWidth maxWidth="sm">
    <DialogTitle id="leave-badgework-title">Unsaved badgework changes</DialogTitle>
    <DialogContent><Typography>Save your changes, discard them, or stay to keep editing.</Typography></DialogContent>
    <DialogActions sx={{ flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44 } }}>
      <Button autoFocus disabled={saving} onClick={leave.stay}>Stay</Button>
      <Button color="warning" disabled={saving} onClick={leave.continueWithoutSaving}>Discard</Button>
      <Button variant="contained" disabled={saving} onClick={() => void leave.saveAndContinue()}>Save</Button>
    </DialogActions>
  </Dialog>;
}
