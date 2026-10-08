import { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";

import type { EventAudience } from "../../services/eventAdmin";
import type { MemberRecord } from "../../services/memberAdmin";
import { buildEventAudience, eventAudienceSummary } from "../../services/eventManagementLogic";

type Props = {
  classificationSection: string;
  audience: EventAudience | null;
  members: MemberRecord[];
  disabled?: boolean;
  onChange: (audience: EventAudience) => void;
};

function sectionsFor(member: MemberRecord): string[] {
  return member.sections?.length ? member.sections : [member.section];
}

export default function EventAudienceBuilder({ classificationSection, audience, members, disabled = false, onChange }: Props) {
  const [editingMembers, setEditingMembers] = useState(false);
  const [addingOtherMembers, setAddingOtherMembers] = useState(false);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState(classificationSection);
  const sections = useMemo(() => [...new Set(members.flatMap(sectionsFor).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [members]);
  const activeSectionFilter = sections.includes(sectionFilter) ? sectionFilter : sections.includes(classificationSection) ? classificationSection : sections[0] ?? "";
  const selectedSectionIds = useMemo(() => audience?.sectionIds ?? (classificationSection === "All Sections" ? sections : sections.includes(classificationSection) ? [classificationSection] : []), [audience, classificationSection, sections]);
  const selectedMemberIds = useMemo(() => audience?.memberIds ?? [], [audience]);
  const resolved = useMemo(() => buildEventAudience(selectedSectionIds, selectedMemberIds, members), [members, selectedMemberIds, selectedSectionIds]);
  const isSelectedMembers = audience?.mode === "members" || audience?.mode === "mixed";
  const normalizedSearch = search.trim().toLocaleLowerCase("en-IE");
  const visibleMembers = members.filter((member) => member.status === "active" && (
    addingOtherMembers
      ? (!normalizedSearch || `${member.displayName} ${sectionsFor(member).join(" ")}`.toLocaleLowerCase("en-IE").includes(normalizedSearch))
      : sectionsFor(member).includes(activeSectionFilter)
  ));

  const currentMode = audience?.mode ?? "sections";
  const update = (sectionIds: string[], memberIds: string[], mode?: "sections" | "members" | "mixed") => onChange(buildEventAudience(sectionIds, [...new Set(memberIds)], members, mode));
  const chooseWholeSections = () => {
    const sectionIds = selectedSectionIds.length ? selectedSectionIds : classificationSection === "All Sections" ? sections : sections.includes(classificationSection) ? [classificationSection] : [];
    update(sectionIds, [], "sections");
    setEditingMembers(false);
    setAddingOtherMembers(false);
  };
  const chooseSelectedMembers = () => {
    const initialIds = resolved.resolvedMemberIds.length > 0
      ? [...new Set([...selectedMemberIds, ...resolved.resolvedMemberIds])]
      : members.filter((member) => member.status === "active" && (classificationSection === "All Sections" || sectionsFor(member).includes(classificationSection))).map((member) => member.id);
    update([], initialIds, "members");
    setEditingMembers(true);
  };
  const toggleSection = (section: string) => {
    const next = new Set(selectedSectionIds);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    update([...next], selectedMemberIds, currentMode === "mixed" ? "mixed" : isSelectedMembers ? "members" : "sections");
  };
  const toggleMember = (memberId: string) => {
    const next = new Set(selectedMemberIds);
    if (next.has(memberId)) next.delete(memberId);
    else next.add(memberId);
    update(selectedSectionIds, [...next], currentMode === "mixed" ? "mixed" : isSelectedMembers ? "members" : "sections");
  };
  const setVisibleMembers = (selected: boolean) => {
    const next = new Set(selectedMemberIds);
    visibleMembers.forEach((member) => selected ? next.add(member.id) : next.delete(member.id));
    update(selectedSectionIds, [...next], currentMode === "mixed" ? "mixed" : isSelectedMembers ? "members" : "sections");
  };
  const summaryCount = audience?.mode === "members"
    ? selectedMemberIds.length
    : Math.max(resolved.resolvedMemberIds.length, audience?.resolvedMemberIds.length ?? 0);
  const summary = eventAudienceSummary(selectedSectionIds, selectedMemberIds, summaryCount);

  return <Box data-testid="event-audience-builder">
    <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Event audience</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Event section is classification only. Choose who is invited below.</Typography>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
      <Button disabled={disabled} variant={!isSelectedMembers ? "contained" : "outlined"} onClick={chooseWholeSections}>Whole section(s)</Button>
      <Button disabled={disabled || members.length === 0} variant={isSelectedMembers ? "contained" : "outlined"} onClick={chooseSelectedMembers}>Selected members</Button>
    </Stack>
    {!isSelectedMembers ? <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
        <Button disabled={disabled || sections.length === 0} onClick={() => update(sections, selectedMemberIds)}>Select all authorized sections</Button>
        <Button disabled={disabled} onClick={() => update([], selectedMemberIds)}>Clear sections</Button>
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
        {sections.map((section) => <FormControlLabel key={section} control={<Checkbox disabled={disabled} checked={selectedSectionIds.includes(section)} onChange={() => toggleSection(section)} />} label={`${section} (${members.filter((member) => member.status === "active" && sectionsFor(member).includes(section)).length})`} />)}
      </Stack>
    </> : <>
      <Alert severity="info" role="status" sx={{ mb: 1 }}>
        {summary}. {audience?.mode === "mixed" ? "Selected sections and individual members are both included." : "Only the members selected here will be invited."} Changing the event classification does not expand the audience.
      </Alert>
      {audience?.mode === "mixed" && <Stack direction={{ xs: "column", sm: "row" }} useFlexGap sx={{ flexWrap: "wrap", gap: 1, mb: 1 }}>
        {sections.map((section) => <FormControlLabel key={section} control={<Checkbox disabled={disabled} checked={selectedSectionIds.includes(section)} onChange={() => toggleSection(section)} />} label={`${section} section`} />)}
      </Stack>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
        <Button disabled={disabled} variant="outlined" onClick={() => setEditingMembers((open) => !open)}>{editingMembers ? "Close member selection" : "Edit selection"}</Button>
        <Button disabled={disabled} onClick={() => update([], [], "members")}>Clear all members</Button>
        <Button disabled={disabled} onClick={() => { setAddingOtherMembers((open) => !open); setEditingMembers(true); setSearch(""); }}>
          {addingOtherMembers ? "Close group search" : "Add other group members"}
        </Button>
      </Stack>
      {selectedMemberIds.length > 0 && <Typography variant="body2" aria-live="polite" sx={{ mb: 1 }}>Selected: {selectedMemberIds.map((id) => members.find((member) => member.id === id)?.displayName).filter(Boolean).join(", ") || `${selectedMemberIds.length} member${selectedMemberIds.length === 1 ? "" : "s"}`}</Typography>}
      {editingMembers && <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: { xs: 1, sm: 1.5 } }}>
        {addingOtherMembers ? <>
          <TextField fullWidth label="Search authorized group members" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Each result is added individually, even if the member belongs to another section.</Typography>
        </> : <>
          <FormControl fullWidth sx={{ mb: 1 }}>
            <InputLabel id="event-audience-section-filter-label">Section filter</InputLabel>
            <Select labelId="event-audience-section-filter-label" label="Section filter" value={activeSectionFilter} disabled={disabled} onChange={(event) => setSectionFilter(event.target.value)}>
              {sections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button disabled={disabled || !activeSectionFilter} onClick={() => setVisibleMembers(true)}>Select all in {activeSectionFilter || "section"}</Button>
            <Button disabled={disabled || !activeSectionFilter} onClick={() => setVisibleMembers(false)}>Clear {activeSectionFilter || "section"}</Button>
          </Stack>
        </>}
        <Stack spacing={0.25} sx={{ maxHeight: 360, overflowY: "auto" }}>
          {visibleMembers.map((member) => <FormControlLabel key={member.id} control={<Checkbox disabled={disabled} checked={selectedMemberIds.includes(member.id)} onChange={() => toggleMember(member.id)} />} label={`${member.displayName} · ${sectionsFor(member).join(", ")}`} />)}
          {visibleMembers.length === 0 && <Typography variant="body2" color="text.secondary">No active members match this selection.</Typography>}
        </Stack>
      </Box>}
    </>}
    <Typography variant="body2" data-testid="event-audience-summary" aria-live="polite" sx={{ mt: 1 }}>{summary}</Typography>
  </Box>;
}
