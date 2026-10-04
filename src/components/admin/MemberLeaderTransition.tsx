import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField } from "@mui/material";
import { useState } from "react";
import type { MemberRecord } from "../../services/memberAdmin";
import { createMemberLeaderTransitionInvitation } from "../../services/memberLeaderTransition";

export default function MemberLeaderTransition({ member, disabled = false }: { member: MemberRecord; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [endMembership, setEndMembership] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const prepare = async () => {
    setSaving(true); setError("");
    try { setUrl(await createMemberLeaderTransitionInvitation(member, endMembership)); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to prepare the registration link. Check that the saved member record has a name and email address, then try again.", "MemberLeaderTransition")); }
    finally { setSaving(false); }
  };
  return <>
    <Button disabled={disabled} variant="outlined" onClick={() => { setUrl(""); setError(""); setEndMembership(!member.sections.includes("Rovers")); setOpen(true); }} sx={{ mt: 3 }}>Transition to Leader</Button>
    <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="sm" fullWidth aria-labelledby="member-leader-transition-title">
      <DialogTitle id="member-leader-transition-title">Transition member to Leader</DialogTitle>
      <DialogContent dividers><Stack spacing={2}>
        <Alert severity="info">This prepares the standard Leader Registration link for {member.displayName}. No membership or leader access changes until the member submits and an administrator approves the request.</Alert>
        <Alert severity="info">The link uses saved member details. Save any contact changes before preparing it, then give the link to the member to complete using their own login.</Alert>
        <FormControlLabel control={<Checkbox checked={endMembership} disabled={saving || Boolean(url)} onChange={(event) => setEndMembership(event.target.checked)} />} label="End this member's current youth membership after leader approval" />
        {url && <><TextField label="Leader registration link" value={url} fullWidth slotProps={{ input: { readOnly: true } }} /><Button onClick={() => { void navigator.clipboard.writeText(url).catch((failure) => setError(applicationErrorMessage(failure, "Unable to copy the link. Select and copy it from the field above.", "MemberLeaderTransition"))); }}>Copy registration link</Button></>}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)} disabled={saving}>{url ? "Close" : "Cancel"}</Button>{!url && <Button variant="contained" onClick={() => void prepare()} disabled={saving}>{saving ? "Preparing…" : "Prepare registration link"}</Button>}</DialogActions>
    </Dialog>
  </>;
}
