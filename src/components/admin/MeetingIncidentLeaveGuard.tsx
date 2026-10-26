import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useConfirmEventLeave } from "../../hooks/useConfirmEventLeave";
/** Keyed to the meeting visit so a released navigation guard cannot leak to the next record. */
export default function MeetingIncidentLeaveGuard({ dirty, save, saving }: { dirty: boolean; save: () => Promise<boolean>; saving: boolean }) {
  const leave = useConfirmEventLeave(dirty, save, undefined, true);
  return <Dialog open={leave.dialogOpen} onClose={saving ? undefined : leave.stay} aria-labelledby="incident-leave-title" fullWidth maxWidth="xs">
    <DialogTitle id="incident-leave-title">Unsaved incident form</DialogTitle>
    <DialogContent>Save the meeting including this incident, discard unsaved changes and leave, or stay to continue entering details. A member and concern are required to save.</DialogContent>
    <DialogActions sx={{ flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44 } }}><Button autoFocus disabled={saving} onClick={leave.stay}>Stay</Button><Button color="error" disabled={saving} onClick={leave.continueWithoutSaving}>Discard</Button><Button variant="contained" disabled={saving} onClick={() => void leave.saveAndContinue()}>Save</Button></DialogActions>
  </Dialog>;
}
