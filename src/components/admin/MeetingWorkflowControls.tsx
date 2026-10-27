import { useLocation } from "react-router-dom";
import { backDismissStack } from "../../services/backDismissHistory";
import { Alert, Box, Button, Chip, Menu, MenuItem, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useState, type ComponentProps } from "react";
import { useBackDismiss } from "../../hooks/useBackDismiss";
import type WeeklyMeetingEditorControls from "./WeeklyMeetingEditorControls";
import { meetingStage, type MeetingStep } from "../../services/meetingWorkflow";

type Props = ComponentProps<typeof WeeklyMeetingEditorControls> & { onShare?: () => void; saving: boolean; dirty: boolean; error: string };
export default function MeetingWorkflowControls(p: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuReady = useBackDismiss(Boolean(anchor), () => setAnchor(null), "meeting-actions");
  const stage = meetingStage(p.step);
  const location = useLocation();
  const [requested, setRequested] = useState<"share" | "equipment" | "copy" | "create" | null>(null);
  useEffect(() => {
    if (requested && !anchor && !backDismissStack(location.state).some(marker => marker.startsWith("meeting-actions:"))) {
      setRequested(null);
      if (requested === "share") p.onShare?.();
      else if (requested === "equipment") p.setEquipmentOpen(true);
      else void p.requestNavigationAction(requested);
    }
  }, [requested, anchor, location.state, p.onShare, p.setEquipmentOpen, p.requestNavigationAction]);
  return <>
    <Paper ref={p.editorTopRef} variant="outlined" data-testid="meeting-workflow-shell" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, minWidth: 0, scrollMarginTop: 16 }}>
      <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <Button disabled={p.saving} onClick={() => void p.requestNavigationAction("meetings")} sx={{ minHeight: 44 }}>Back to Weekly Meetings</Button>
        <Button disabled={p.saving} id="meeting-more" aria-haspopup="menu" aria-expanded={Boolean(anchor)} aria-controls={anchor ? "meeting-actions" : undefined} onClick={e => setAnchor(e.currentTarget)} sx={{ minHeight: 44 }}>More actions</Button>
      </Stack>
      <Typography variant="h5" component="h2" color="secondary" sx={{ fontWeight: 800, overflowWrap: "anywhere", mt: 1 }}>{p.selected.section} · {p.selected.theme || "Weekly meeting"}</Typography>
      <Typography sx={{ overflowWrap: "anywhere" }}>{p.selected.meetingDate.split("-").reverse().join("-")} · {p.selected.location || "Location not set"}</Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
        <Chip size="small" label={p.selected.status === "open" ? "Open" : "Closed"} />
        <Chip size="small" label={`${p.programmeDuration} min planned`} />
        <Chip size="small" label={`${p.present}/${p.total} present`} />
      </Stack>
      <Typography role="status" aria-live="polite" sx={{ mt: 1 }} data-testid="meeting-save-state">{p.saving ? "Saving…" : p.error ? "Save failed — your edits are retained" : p.dirty ? "Unsaved changes" : "Saved"}</Typography>
      <Menu id="meeting-actions" anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ list: { "aria-labelledby": "meeting-more" } }}>
        <MenuItem disabled={!menuReady || p.saving} sx={{ minHeight: 44 }} onClick={() => { setAnchor(null); setRequested("equipment"); }}>Equipment</MenuItem>
        <MenuItem sx={{ minHeight: 44 }} disabled={!menuReady || p.saving} onClick={() => { setAnchor(null); setRequested("share"); }}>Share in WhatsApp</MenuItem>
        {!p.readOnly && <MenuItem disabled={!menuReady || p.saving} sx={{ minHeight: 44 }} onClick={() => { setAnchor(null); setRequested("copy"); }}>Copy Meeting</MenuItem>}
        {!p.readOnly && <MenuItem disabled={!menuReady || p.saving} sx={{ minHeight: 44 }} onClick={() => { setAnchor(null); setRequested("create"); }}>Create another</MenuItem>}
      </Menu>
    </Paper>
    {p.selected.status === "closed" && <Alert severity="info" data-testid="past-meeting-edit-notice">{p.operationalReadOnly ? "This past meeting is read-only. Section Leaders, the Group Leader and Deputy Group Leader can update attendance, medical issues and additional notes." : "Past meeting: only attendance, injuries / medical issues and additional notes can be changed. Programme and completed badgework are locked."}</Alert>}
    <Box role="group" aria-label="Meeting stages" sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 1 }}>
      {([["plan", "programme", "Plan"], ["run", "attendance", "Run"], ["review", "badgework", "Review"]] as const).map(([id, step, label]) => <Button key={id} aria-pressed={stage === id} onClick={() => p.setStep(step as MeetingStep)} sx={theme => ({ minHeight: 44, minWidth: 0, color: "secondary.main", borderRadius: 2, borderBottom: "3px solid", borderColor: stage === id ? "secondary.main" : "transparent", backgroundColor: stage === id ? alpha(theme.palette.secondary.main, .09) : "transparent", fontWeight: 800 })}>{label}</Button>)}
    </Box>
    <Typography component="h2" variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{stage === "plan" ? "Plan meeting" : stage === "run" ? "Run meeting" : "Review meeting"}</Typography>
  </>;
}
