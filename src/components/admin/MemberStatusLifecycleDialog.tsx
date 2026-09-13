import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";

import type { MemberRecord } from "../../services/memberAdmin";
import type { ParentLifecycleCandidate } from "../../services/parentLifecycleLogic";

type Props = {
  open: boolean;
  member: MemberRecord | null;
  previousStatus: MemberRecord["status"] | null;
  candidates: ParentLifecycleCandidate[];
  saving: boolean;
  onCancel: () => void;
  onMemberOnly: () => void;
  onMemberAndParents: () => void;
};

const label = (status: MemberRecord["status"]) => status === "active" ? "Active" : status === "inactive" ? "Inactive" : "Left";

export default function MemberStatusLifecycleDialog({ open, member, previousStatus, candidates, saving, onCancel, onMemberOnly, onMemberAndParents }: Props) {
  if (!member || !previousStatus) return null;
  const disabling = member.status !== "active";
  return <Dialog open={open} onClose={() => !saving && onCancel()} aria-labelledby="member-status-confirmation-title" maxWidth="sm" fullWidth>
    <DialogTitle id="member-status-confirmation-title">Confirm member status change?</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <Typography><strong>{member.displayName}</strong> will change from {label(previousStatus)} to {label(member.status)}.</Typography>
        <Alert severity={member.status === "active" ? "info" : "warning"}>
          {member.status === "active" ? "The member will return to active status in the member register." : member.status === "inactive" ? "The member will be marked inactive while their record and lifecycle history are retained." : "The member will be marked as having left while their record and lifecycle history are retained."}
        </Alert>
        {disabling && candidates.length > 0 && <Alert severity="warning">
          This is the last active linked member for {candidates.length === 1 ? <strong>{candidates[0].parent.displayName}</strong> : <strong>{candidates.length} parent accounts</strong>}. You can disable only the member, or also disable Parent Portal access. Child links and any Leader access will be retained.
        </Alert>}
        {disabling && candidates.length === 0 && <Typography color="text.secondary">No approved linked parent account needs disabling as a result of this status change.</Typography>}
        <Typography color="text.secondary">This uses explicit parent-child links only. Family/sibling membership never grants or revokes Parent Portal access.</Typography>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ flexWrap: "wrap" }}>
      <Button disabled={saving} onClick={onCancel}>Cancel</Button>
      <Button variant="outlined" color={member.status === "active" ? "success" : "warning"} disabled={saving} onClick={onMemberOnly}>{saving ? "Saving..." : disabling ? "Disable member only" : "Confirm status change"}</Button>
      {disabling && candidates.length > 0 && <Button variant="contained" color="warning" disabled={saving} onClick={onMemberAndParents}>{saving ? "Saving..." : candidates.length === 1 ? "Disable member and parent" : "Disable member and parents"}</Button>}
    </DialogActions>
  </Dialog>;
}
