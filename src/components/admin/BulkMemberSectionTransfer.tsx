import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import type { MemberRecord } from "../../services/memberAdmin";
import { bulkTransferMembersSection, loadBulkTransferDestinations, type YouthMemberSection } from "../../services/bulkMemberSectionTransfer";

type Props = {
  members: MemberRecord[];
  visibleMembers: MemberRecord[];
  onTransferred: () => Promise<void>;
};

export default function BulkMemberSectionTransfer({ members, visibleMembers, onTransferred }: Props) {
  const [active, setActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [destination, setDestination] = useState("");
  const [destinations, setDestinations] = useState<YouthMemberSection[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!active) return;
    void loadBulkTransferDestinations().then(setDestinations).catch(() => setError("Unable to load authorised destination sections."));
  }, [active]);

  const selected = useMemo(() => members.filter((member) => selectedIds.has(member.id)), [members, selectedIds]);
  const eligibleVisible = useMemo(() => visibleMembers.filter((member) => member.status === "active"), [visibleMembers]);
  const visibleSelected = eligibleVisible.filter((member) => selectedIds.has(member.id)).length;
  const hiddenSelected = selected.length - visibleSelected;
  const movable = selected.filter((member) => member.section !== destination);

  const toggle = (memberId: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(memberId)) next.delete(memberId); else next.add(memberId);
    return next;
  });

  const selectVisible = () => setSelectedIds((current) => new Set([...current, ...eligibleVisible.map((member) => member.id)]));
  const clearVisible = () => setSelectedIds((current) => {
    const next = new Set(current);
    eligibleVisible.forEach((member) => next.delete(member.id));
    return next;
  });
  const clearAll = () => setSelectedIds(new Set());

  const exit = () => {
    setActive(false);
    setSelectedIds(new Set());
    setDestination("");
    setReviewOpen(false);
    setError("");
  };

  const transfer = async () => {
    if (saving || !destination || movable.length === 0) return;
    setSaving(true);
    setError("");
    try {
      await bulkTransferMembersSection(selected, destination);
      await onTransferred();
      setMessage(`${movable.length} member${movable.length === 1 ? "" : "s"} moved to ${destination}.`);
      setSelectedIds(new Set());
      setDestination("");
      setReviewOpen(false);
      setActive(false);
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : "The transfer was safely rejected. Refresh and try again.");
      setReviewOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!active) return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      {message && <Alert severity="success" role="status" onClose={() => setMessage("")}>{message}</Alert>}
      {error && <Alert severity="error" role="alert" onClose={() => setError("")}>{error}</Alert>}
      <Box><Button variant="outlined" onClick={() => { setActive(true); setMessage(""); }}>Select members</Button></Box>
    </Stack>
  );

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }} data-testid="bulk-member-selection">
      <Stack spacing={2}>
        <Box aria-live="polite">
          <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Bulk section transfer</Typography>
          <Typography>{selected.length} selected · {visibleSelected} visible{hiddenSelected > 0 ? ` · ${hiddenSelected} hidden by current filters` : ""}</Typography>
        </Box>
        {error && <Alert severity="error" role="alert">{error}</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button onClick={selectVisible} disabled={eligibleVisible.length === 0}>Select all visible</Button>
          <Button onClick={clearVisible} disabled={visibleSelected === 0}>Clear visible</Button>
          <Button onClick={clearAll} disabled={selected.length === 0}>Clear all</Button>
          <Button onClick={exit}>Cancel selection</Button>
        </Stack>
        <Box role="group" aria-label="Visible members" sx={{ display: "grid", gap: 1 }}>
          {visibleMembers.map((member) => {
            const eligible = member.status === "active";
            return (
              <Paper key={member.id} variant="outlined" sx={{ px: 1.5, py: 1, opacity: eligible ? 1 : 0.65 }}>
                <FormControlLabel
                  sx={{ m: 0, width: "100%", minHeight: 44 }}
                  control={<Checkbox checked={selectedIds.has(member.id)} disabled={!eligible} onChange={() => toggle(member.id)} slotProps={{ input: { "aria-label": `Select ${member.displayName}` } }} />}
                  label={<Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography>{member.displayName}</Typography><Chip size="small" variant="outlined" label={member.section} />{!eligible && <Chip size="small" label={member.status} />}</Stack>}
                />
              </Paper>
            );
          })}
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
          <FormControl sx={{ minWidth: 220 }} disabled={selected.length === 0}>
            <InputLabel id="bulk-destination-label">Destination section</InputLabel>
            <Select labelId="bulk-destination-label" label="Destination section" value={destination} onChange={(event) => setDestination(event.target.value)}>
              {destinations.map((section) => <MenuItem key={section} value={section} disabled={selected.length > 0 && selected.every((member) => member.section === section)}>{section}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" color="success" disabled={!destination || movable.length === 0 || saving} onClick={() => setReviewOpen(true)}>Change section</Button>
        </Stack>
      </Stack>

      <Dialog open={reviewOpen} onClose={() => !saving && setReviewOpen(false)} fullWidth maxWidth="sm" aria-labelledby="bulk-transfer-title">
        <DialogTitle id="bulk-transfer-title">Move {movable.length} member{movable.length === 1 ? "" : "s"} to {destination}?</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 2 }}>This changes each member's current section only. Existing family links, Subs, consent, attendance, Badgework and historical records remain attached to the same member.</Typography>
          {selected.filter((member) => member.section === destination).length > 0 && <Alert severity="info" sx={{ mb: 2 }}>{selected.filter((member) => member.section === destination).length} selected member(s) are already in {destination} and will not be changed.</Alert>}
          <Stack spacing={1}>{movable.map((member) => <Box key={member.id}><strong>{member.displayName}</strong> — {member.section} → {destination}</Box>)}</Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setReviewOpen(false)}>Back</Button>
          <Button variant="contained" color="success" disabled={saving || movable.length === 0} onClick={() => void transfer()}>{saving ? "Moving members..." : "Confirm transfer"}</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
