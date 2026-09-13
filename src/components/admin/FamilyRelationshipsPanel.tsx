import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Paper, Stack, TextField, Typography
} from "@mui/material";
import { useMemo, useState } from "react";

import { familySearchResults } from "../../services/familyRelationshipLogic";
import { linkSibling, unlinkFromFamily } from "../../services/familyRelationships";
import type { MemberRecord } from "../../services/memberAdmin";

type Props = {
  member: MemberRecord;
  members: MemberRecord[];
  onChanged: () => Promise<void>;
};

export default function FamilyRelationshipsPanel({ member, members, onChanged }: Props) {
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const siblings = useMemo(
    () => member.familyId ? members.filter((candidate) => candidate.id !== member.id && candidate.familyId === member.familyId) : [],
    [member, members]
  );
  const results = useMemo(() => familySearchResults(members, member, search), [members, member, search]);

  const link = async (siblingId: string) => {
    setWorking(true); setError("");
    try {
      await linkSibling(members, member.id, siblingId);
      setSearch("");
      await onChanged();
    } catch (linkError) {
      console.error("Unable to link sibling:", linkError);
      setError(linkError instanceof Error ? linkError.message : "Unable to link this sibling.");
    } finally { setWorking(false); }
  };

  const unlink = async () => {
    setWorking(true); setError("");
    try {
      await unlinkFromFamily(members, member.id);
      setUnlinkConfirmOpen(false);
      await onChanged();
    } catch (unlinkError) {
      console.error("Unable to unlink family relationship:", unlinkError);
      setError(unlinkError instanceof Error ? unlinkError.message : "Unable to unlink this family relationship.");
    } finally { setWorking(false); }
  };

  return <>
    <Stack spacing={2} data-testid="member-family-management">
      <Alert severity="info">
        Family links are long-lived sibling relationships for administration. They do not grant Parent Portal access and do not change Subs family accounts or discounts.
      </Alert>
      {error && <Alert severity="error" role="alert">{error}</Alert>}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Current family</Typography>
        {siblings.length === 0 ? <Typography color="text.secondary">No siblings are linked.</Typography> : <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
          {siblings.map((sibling) => <Chip key={sibling.id} label={`${sibling.displayName} · ${sibling.section} · ${sibling.status}`} />)}
        </Stack>}
      </Box>
      {member.familyId && <Box><Button variant="outlined" color="error" disabled={working} onClick={() => setUnlinkConfirmOpen(true)}>{working ? "Updating..." : "Remove from family"}</Button></Box>}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Link sibling</Typography>
        <TextField fullWidth label="Search existing members" value={search} disabled={working} onChange={(event) => setSearch(event.target.value)} placeholder="Member name or section" />
        {working && <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}><CircularProgress size={18} /><Typography color="text.secondary">Updating family relationship…</Typography></Box>}
        {search.trim() && results.length === 0 && <Alert severity="info" sx={{ mt: 1.5 }}>No eligible members match. Current family members are excluded.</Alert>}
        {results.length > 0 && <Stack spacing={1} sx={{ mt: 1.5 }}>
          {results.map((candidate) => <Paper key={candidate.id} variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1, justifyContent: "space-between", alignItems: { sm: "center" } }}>
            <Box><Typography sx={{ fontWeight: 700 }}>{candidate.displayName}</Typography><Typography variant="body2" color="text.secondary">{candidate.section} · {candidate.status}{candidate.familyId ? " · already in another family (groups will merge)" : ""}</Typography></Box>
            <Button variant="contained" color="secondary" disabled={working} onClick={() => void link(candidate.id)}>Link sibling</Button>
          </Paper>)}
        </Stack>}
      </Box>
      <Typography variant="caption" color="text.secondary">Family membership updates are transactional and each completed change is recorded in the audit trail.</Typography>
    </Stack>
    <Dialog open={unlinkConfirmOpen} onClose={() => !working && setUnlinkConfirmOpen(false)} aria-labelledby="family-unlink-dialog-title" fullWidth maxWidth="sm">
      <DialogTitle id="family-unlink-dialog-title">Remove from family?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Remove {member.displayName} from this family group? {siblings.length === 1 ? "Because this family has only two members, the remaining member will also become ungrouped." : "The remaining family members will stay grouped together."} Parent Portal child access and Subs family accounts will not be changed.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button disabled={working} onClick={() => setUnlinkConfirmOpen(false)}>Cancel</Button>
        <Button color="error" variant="contained" disabled={working} onClick={() => void unlink()}>{working ? "Removing..." : "Remove from family"}</Button>
      </DialogActions>
    </Dialog>
  </>;
}
