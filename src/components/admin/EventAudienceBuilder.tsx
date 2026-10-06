import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMemo, useState } from "react";
import type { EventAudience } from "../../services/eventAdmin";
import type { MemberRecord } from "../../services/memberAdmin";
import { buildEventAudience, eventAudienceSummary } from "../../services/eventManagementLogic";
import { memberBelongsToSection } from "../../services/memberSectionCore.mjs";

type Props = {
  classificationSection: string;
  audience: EventAudience | null;
  members: MemberRecord[];
  onChange: (audience: EventAudience) => void;
};

type AudienceMode = "sections" | "members";

export default function EventAudienceBuilder({ classificationSection, audience, members, onChange }: Props) {
  const [mode, setMode] = useState<AudienceMode>(audience?.mode === "members" ? "members" : "sections");
  const [sectionFilter, setSectionFilter] = useState(classificationSection === "All Sections" ? "All Sections" : classificationSection);
  const [memberSearch, setMemberSearch] = useState("");
  const [showOtherMembers, setShowOtherMembers] = useState(false);
  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);
  const sections = useMemo(() => [...new Set(activeMembers.flatMap((member) => member.sections?.length ? member.sections : [member.section]).filter(Boolean))].sort(), [activeMembers]);
  const selectedSections = audience?.sectionIds ?? [];
  const selectedMemberIds = audience?.memberIds ?? [];
  const selectedCount = audience?.resolvedMemberIds.length ?? 0;
  const visibleMembers = activeMembers.filter((member) => (sectionFilter === "All Sections" || memberBelongsToSection(member, sectionFilter))
    && (!memberSearch.trim() || `${member.displayName} ${member.section}`.toLowerCase().includes(memberSearch.trim().toLowerCase())));

  const update = (nextMode: AudienceMode, sectionIds: string[], memberIds: string[]) => {
    const snapshot = buildEventAudience(sectionIds, memberIds, activeMembers);
    onChange({ ...snapshot, mode: nextMode === "members" ? "members" : snapshot.mode });
  };

  const chooseMode = (nextMode: AudienceMode) => {
    if (nextMode === mode) return;
    if (nextMode === "members") {
      // Starting from the existing whole-section audience gives the organiser a
      // useful filtered selection they can clear or narrow before confirming.
      const ids = audience?.resolvedMemberIds ?? [];
      update("members", [], ids);
    } else {
      const initialSections = classificationSection === "All Sections"
        ? sections
        : [classificationSection].filter((section) => sections.includes(section));
      update("sections", initialSections, []);
    }
    setMode(nextMode);
    setSectionFilter(classificationSection === "All Sections" ? "All Sections" : classificationSection);
    setMemberSearch("");
  };

  const toggleMember = (memberId: string) => {
    const next = new Set(selectedMemberIds);
    if (next.has(memberId)) next.delete(memberId);
    else next.add(memberId);
    update(mode, mode === "members" ? [] : selectedSections, [...next]);
  };

  const setVisibleSelection = (select: boolean) => {
    const next = new Set(selectedMemberIds);
    visibleMembers.forEach((member) => select ? next.add(member.id) : next.delete(member.id));
    update(mode, mode === "members" ? [] : selectedSections, [...next]);
  };

  const toggleSection = (section: string, checked: boolean) => {
    const next = new Set(selectedSections);
    if (checked) next.add(section);
    else next.delete(section);
    update("sections", [...next], selectedMemberIds);
  };

  const clearAll = () => update(mode, mode === "members" ? [] : selectedSections, []);

  return <Box data-testid="event-audience-builder" sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: { xs: 1.25, sm: 2 } }}>
    <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Invited audience</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      Event section: <strong>{classificationSection}</strong>. This classification stays separate from who receives an invitation.
    </Typography>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
      <Button variant={mode === "sections" ? "contained" : "outlined"} onClick={() => chooseMode("sections")}>Whole selected sections</Button>
      <Button variant={mode === "members" ? "contained" : "outlined"} onClick={() => chooseMode("members")}>Selected members</Button>
    </Stack>

    {mode === "sections" ? <>
      <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75, mb: 1 }}>
        <Button size="small" onClick={() => update("sections", sections, selectedMemberIds)}>Select Group</Button>
        <Button size="small" onClick={() => update("sections", [], selectedMemberIds)}>Clear sections</Button>
      </Stack>
      <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75 }} aria-label="Sections invited">
        {sections.map((section) => <FormControlLabel key={section} control={<Checkbox checked={selectedSections.includes(section)} onChange={(event) => toggleSection(section, event.target.checked)} />} label={`${section} (${activeMembers.filter((member) => memberBelongsToSection(member, section)).length})`} />)}
      </Stack>
    </> : <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Choose a section to review its members. Selections remain in place as you switch sections.</Typography>
      <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75, mb: 1 }} aria-label="Filter members by section">
        <Button size="small" variant={sectionFilter === "All Sections" ? "contained" : "outlined"} onClick={() => setSectionFilter("All Sections")}>All authorised sections</Button>
        {sections.map((section) => <Button key={section} size="small" variant={sectionFilter === section ? "contained" : "outlined"} onClick={() => setSectionFilter(section)}>{section}</Button>)}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Button size="small" onClick={() => setVisibleSelection(true)}>Select all visible</Button>
        <Button size="small" onClick={() => setVisibleSelection(false)}>Clear visible</Button>
        <Button size="small" color="warning" onClick={clearAll}>Clear all</Button>
      </Stack>
      <TextField fullWidth size="small" label="Search this section" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} sx={{ mb: 1 }} />
      <Stack spacing={0.25} sx={{ maxHeight: 280, overflowY: "auto" }} aria-label="Members in selected section">
        {visibleMembers.map((member) => <FormControlLabel key={member.id} control={<Checkbox checked={selectedMemberIds.includes(member.id)} onChange={() => toggleMember(member.id)} />} label={`${member.displayName} · ${member.section}`} />)}
        {visibleMembers.length === 0 && <Typography color="text.secondary" sx={{ p: 1 }}>No active members match this section and search.</Typography>}
      </Stack>
      <Accordion disableGutters elevation={0} expanded={showOtherMembers} onChange={(_event, expanded) => setShowOtherMembers(expanded)} sx={{ mt: 1, border: 1, borderColor: "divider", "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 700 }}>Add other group members</Typography></AccordionSummary>
        <AccordionDetails>
          <TextField fullWidth size="small" label="Search authorised members" value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setSectionFilter("All Sections"); }} sx={{ mb: 1 }} />
          <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75 }}>
            {visibleMembers.map((member) => <Chip key={member.id} label={`${member.displayName} · ${member.section}`} clickable onClick={() => toggleMember(member.id)} color={selectedMemberIds.includes(member.id) ? "primary" : "default"} variant={selectedMemberIds.includes(member.id) ? "filled" : "outlined"} />)}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </>}

    <Box sx={{ mt: 1.5 }}>
      <Alert severity={mode === "members" && selectedCount === 0 ? "warning" : "info"} role="status" data-testid="event-audience-summary">
        {mode === "members" && selectedCount === 0 ? "Select at least one active member before saving." : eventAudienceSummary(selectedSections, selectedMemberIds, selectedCount)}
      </Alert>
      {selectedMemberIds.length > 0 && <Box sx={{ mt: 1 }}>
        <Typography variant="body2" sx={{ mb: 0.5 }}>Selected members ({selectedMemberIds.length})</Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75 }}>
          {activeMembers.filter((member) => selectedMemberIds.includes(member.id)).map((member) => <Chip key={member.id} size="small" label={`${member.displayName} · ${member.section}`} onDelete={() => toggleMember(member.id)} />)}
        </Stack>
      </Box>}
    </Box>
  </Box>;
}
