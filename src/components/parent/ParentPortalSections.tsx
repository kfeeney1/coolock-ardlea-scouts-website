import { Alert, Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import ParentAdventureSkillsSection from "./ParentAdventureSkillsSection";
import ParentConsentSection from "./ParentConsentSection";
import ParentEventConsentSection from "./ParentEventConsentSection";
import ParentThingsToDo from "./ParentThingsToDo";
import ParentPollsSection from "./ParentPollsSection";
import type { ParentLinkedMember } from "../../services/parentConsent";

type Props = {
  linkedChildren: ParentLinkedMember[];
  selectedChild: ParentLinkedMember | null;
  pendingChildId: string | null;
  childrenLoadError: boolean;
  taskSummaryVersion: number;
  onRememberChildSelection: (childId: string) => void;
  onCommitChildSelectionAfterClose: () => void;
  onConsentSaved: () => void;
};

export default function ParentPortalSections({
  linkedChildren,
  selectedChild,
  pendingChildId,
  childrenLoadError,
  taskSummaryVersion,
  onRememberChildSelection,
  onCommitChildSelectionAfterClose,
  onConsentSaved
}: Props) {
  const memberIds = selectedChild ? [selectedChild.id] : [];
  const sections = selectedChild?.sections ?? [];
  const pollSections = [...new Set(linkedChildren.flatMap((child) => child.sections))];
  const portalLinks = [
    ["Things to do", "parent-things-to-do"],
    ["Badgework", "parent-adventure-skills"],
    ["Consent & Medical", "parent-medical-consent"],
    ["Meetings & Events", "parent-event-consent"]
  ] as const;

  return <>
    {childrenLoadError && <Alert severity="warning" sx={{ mb: 3 }}>Child details could not be loaded. Portal navigation remains limited to the approved linked records.</Alert>}
    {!childrenLoadError && linkedChildren.length > 0 && <FormControl fullWidth sx={{ mb: 2 }}>
      <InputLabel id="parent-child-context-label">Viewing information for</InputLabel>
      <Select labelId="parent-child-context-label" label="Viewing information for" value={pendingChildId ?? selectedChild?.id ?? ""} onChange={(event) => onRememberChildSelection(event.target.value)} onClose={onCommitChildSelectionAfterClose} data-testid="parent-child-context">
        {linkedChildren.map((child) => <MenuItem key={child.id} value={child.id}>{child.displayName} · {child.sections.join(", ")}</MenuItem>)}
      </Select>
    </FormControl>}
    {selectedChild && <Typography role="status" aria-live="polite" sx={{ mb: 2 }}>Viewing {selectedChild.displayName} · {selectedChild.sections.join(", ")}</Typography>}
    <Box component="nav" aria-label="Parent Portal sections" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 1, mb: 3 }} data-testid="parent-portal-menu">
      {portalLinks.map(([label, id]) => <Button key={id} component={Link} to={`/parent?child=${encodeURIComponent(selectedChild?.id || "") }#${id}`} onClick={() => window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" })))} variant="outlined" color="secondary" sx={{ minHeight: 48 }}>{label}</Button>)}
    </Box>
    <Box id="parent-dashboard-polls" sx={{ mb: 3 }}><Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Group Polls</Typography><ParentPollsSection key={pollSections.join("|")} sections={pollSections} /></Box>
    <Box id="parent-things-to-do" sx={{ scrollMarginTop: 24 }}><ParentThingsToDo memberIds={memberIds} sections={sections} refreshVersion={taskSummaryVersion} /></Box>
    <Box id="parent-adventure-skills" sx={{ mt: 4, scrollMarginTop: 24 }}><Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Adventure Skills Progress</Typography><ParentAdventureSkillsSection memberIds={memberIds} /></Box>
    <Box id="parent-event-consent" sx={{ mt: 4, scrollMarginTop: 24 }}><Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Upcoming Events & Event Consent</Typography><ParentEventConsentSection memberIds={memberIds} sections={sections} /></Box>
    <Box id="parent-medical-consent" sx={{ mt: 4, scrollMarginTop: 24 }}><Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Consent & Medical Forms</Typography><ParentConsentSection memberIds={memberIds} onSaved={onConsentSaved} /></Box>
  </>;
}
