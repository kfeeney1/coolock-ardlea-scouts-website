import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import type { MemberRecord } from "../../services/memberAdmin";
import { createMemberLeaderTransitionInvitation } from "../../services/memberLeaderTransition";
import { sendMemberLeaderTransitionLink } from "../../services/emailNotifications";

export default function MemberLeaderTransition({ member, disabled = false }: { member: MemberRecord; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [endMembership, setEndMembership] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [message, setMessage] = useState("");
  const prepare = async () => {
    setSaving(true); setError(""); setMessage("");
    try { setUrl(await createMemberLeaderTransitionInvitation(member, endMembership)); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to prepare the registration link. Check that the saved member record has a name and email address, then try again.", "MemberLeaderTransition")); }
    finally { setSaving(false); }
  };
  const sendEmail = async () => {
    const invitationId = new URL(url).searchParams.get("transition");
    if (!invitationId) { setError("The registration link is invalid. Prepare a new link, then try again."); return; }
    setEmailSending(true); setError(""); setMessage("");
    try {
      await sendMemberLeaderTransitionLink(invitationId);
      setMessage(`Registration link sent to ${member.emailAddress.trim()}.`);
    } catch (failure) {
      setError(applicationErrorMessage(failure, "Email could not be sent. Try again or copy the registration link and share it manually.", "MemberLeaderTransition", "Send registration link by email"));
    } finally { setEmailSending(false); }
  };
  const whatsappUrl = url
    ? `https://wa.me/?text=${encodeURIComponent(`Please use this link to continue your Scout leader registration and onboarding: ${url}`)}`
    : "";
  return <>
    <Button disabled={disabled} variant="outlined" onClick={() => { setUrl(""); setError(""); setEndMembership(!member.sections.includes("Rovers")); setOpen(true); }} sx={{ mt: 3 }}>Transition to Leader</Button>
    <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="sm" fullWidth aria-labelledby="member-leader-transition-title">
      <DialogTitle id="member-leader-transition-title">Transition member to Leader</DialogTitle>
      <DialogContent dividers><Stack spacing={2}>
        <Alert severity="info">This prepares the standard Leader Registration link for {member.displayName}. No membership or leader access changes until the member submits and an administrator approves the request.</Alert>
        <Alert severity="info">The link uses saved member details. Save any contact changes before preparing it, then give the link to the member to complete using their own login.</Alert>
        <FormControlLabel control={<Checkbox checked={endMembership} disabled={saving || Boolean(url)} onChange={(event) => setEndMembership(event.target.checked)} />} label="End this member's current youth membership after leader approval" />
        {url && <>
          <TextField label="Leader registration link" value={url} fullWidth slotProps={{ input: { readOnly: true } }} />
          <Typography variant="body2" color="text.secondary">Email recipient: {member.emailAddress.trim()}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button component="a" href={whatsappUrl} target="_blank" rel="noreferrer" variant="outlined" color="success">WhatsApp registration link</Button>
            <Button variant="outlined" onClick={() => void sendEmail()} disabled={emailSending}>{emailSending ? "Sending…" : "Email registration link"}</Button>
            <Button variant="outlined" onClick={() => { void navigator.clipboard.writeText(url).then(() => setMessage("Registration link copied.")).catch((failure) => setError(applicationErrorMessage(failure, "Unable to copy the link. Select and copy it from the field above.", "MemberLeaderTransition"))); }}>Copy registration link</Button>
          </Stack>
        </>}
        {message && <Alert severity="success">{message}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)} disabled={saving || emailSending}>{url ? "Close" : "Cancel"}</Button>{!url && <Button variant="contained" onClick={() => void prepare()} disabled={saving}>{saving ? "Preparing…" : "Prepare registration link"}</Button>}</DialogActions>
    </Dialog>
  </>;
}
