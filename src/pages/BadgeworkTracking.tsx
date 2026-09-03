import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Container, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Paper,
  Select, Stack, TextField, Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { adventureSkills } from "../data/adventureSkills/index.ts";
import { loadMembers, type MemberRecord } from "../services/memberAdmin";
import {
  loadMemberAdventureProgress,
  setRequirementCompletionForMembers,
  setStageAwardForMembers,
  type MemberAdventureProgress
} from "../services/adventureSkillProgress.ts";
import { completeStageDraft, draftSelectionState, setDraftRequirement } from "../services/adventureSkillDraftLogic.ts";
import { requirementSelectionState, selectedMemberSummary } from "../services/adventureSkillSelectionLogic.ts";
import { membersWithIncompleteStage, requirementProvenance, stageAwardSelectionState } from "../services/adventureSkillAwardLogic.ts";
import { badgeworkSourceContextFromParams, sourceBacklink, sourceLabel } from "../services/adventureSkillSourceContext.ts";

type BadgeworkStep = "members" | "badgework";
type DiscardAction = { kind: "skill"; skillId: string } | { kind: "stage"; stage: number } | { kind: "members" };
const displayDate = (value: Date | null) => value ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(value) : "Date pending";

export default function BadgeworkTracking() {
  const [searchParams] = useSearchParams();
  const sourceContext = useMemo(() => badgeworkSourceContextFromParams(searchParams), [searchParams]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sourceSelectionApplied, setSourceSelectionApplied] = useState(false);
  const [workflowStep, setWorkflowStep] = useState<BadgeworkStep>("members");
  const [skillId, setSkillId] = useState(adventureSkills[0]?.id ?? "");
  const [stageNumber, setStageNumber] = useState(1);
  const [section, setSection] = useState("all");
  const [search, setSearch] = useState("");
  const [progressByMemberId, setProgressByMemberId] = useState(new Map<string, MemberAdventureProgress>());
  const [draft, setDraft] = useState(new Map<string, boolean>());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDiscard, setPendingDiscard] = useState<DiscardAction | null>(null);
  const [awardRemovalOpen, setAwardRemovalOpen] = useState(false);

  const skill = adventureSkills.find((item) => item.id === skillId) ?? adventureSkills[0];
  const stage = skill?.stages.find((item) => item.stage === stageNumber) ?? skill?.stages[0];
  const hasUnsavedChanges = draft.size > 0;
  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);
  const sections = useMemo(() => ["all", ...new Set(activeMembers.map((member) => member.section).filter(Boolean))], [activeMembers]);
  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeMembers.filter((member) => (section === "all" || member.section === section) && (!query || `${member.displayName} ${member.section}`.toLowerCase().includes(query)));
  }, [activeMembers, search, section]);
  const selectedMembers = useMemo(() => activeMembers.filter((member) => selectedIds.includes(member.id)), [activeMembers, selectedIds]);
  const awardState = skill && stage ? stageAwardSelectionState(selectedIds, progressByMemberId, skill.id, stage.stage) : "none";
  const incompleteMemberIds = skill && stage ? membersWithIncompleteStage(selectedIds, progressByMemberId, skill.id, stage.stage) : selectedIds;
  const canAward = selectedIds.length > 0 && incompleteMemberIds.length === 0 && !hasUnsavedChanges;
  const singleProgress = selectedIds.length === 1 ? progressByMemberId.get(selectedIds[0]) : undefined;

  const refreshProgress = async (memberIds: readonly string[]) => {
    if (memberIds.length === 0) return;
    const loaded = await Promise.all(memberIds.map((memberId) => loadMemberAdventureProgress(memberId)));
    setProgressByMemberId((current) => {
      const next = new Map(current);
      for (const progress of loaded) next.set(progress.memberId, progress);
      return next;
    });
  };

  useEffect(() => {
    void (async () => {
      try { setMembers(await loadMembers()); }
      catch (loadError) { console.error("Unable to load badgework members:", loadError); setError("Unable to load children for badgework tracking."); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!sourceContext || sourceSelectionApplied || activeMembers.length === 0) return;
    const allowed = new Set(activeMembers.map((member) => member.id));
    setSelectedIds(sourceContext.memberIds.filter((memberId) => allowed.has(memberId)));
    setSourceSelectionApplied(true);
  }, [activeMembers, sourceContext, sourceSelectionApplied]);

  useEffect(() => {
    if (workflowStep !== "badgework") return;
    void refreshProgress(selectedIds).catch((loadError) => { console.error(loadError); setError("Unable to load Adventure Skills progress."); });
  }, [workflowStep, selectedIds.join("|")]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const discardDraft = () => { setDraft(new Map()); setMessage(""); };
  const applyDiscardAction = (action: DiscardAction) => {
    discardDraft();
    if (action.kind === "skill") {
      const nextSkill = adventureSkills.find((item) => item.id === action.skillId);
      setSkillId(action.skillId);
      setStageNumber(nextSkill?.stages[0]?.stage ?? 1);
    } else if (action.kind === "stage") {
      setStageNumber(action.stage);
    } else {
      setWorkflowStep("members");
    }
  };
  const requestDiscardAction = (action: DiscardAction) => {
    if (hasUnsavedChanges) setPendingDiscard(action);
    else applyDiscardAction(action);
  };
  const confirmDiscardAction = () => {
    if (!pendingDiscard) return;
    applyDiscardAction(pendingDiscard);
    setPendingDiscard(null);
  };
  const changeSkill = (nextSkillId: string) => requestDiscardAction({ kind: "skill", skillId: nextSkillId });
  const changeStage = (nextStage: number) => requestDiscardAction({ kind: "stage", stage: nextStage });
  const toggleMember = (memberId: string) => setSelectedIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
  const toggleAllVisible = () => {
    const visibleIds = visibleMembers.map((member) => member.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => allSelected ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])]);
  };
  const clearSelection = () => { setSelectedIds([]); setMessage(""); };
  const continueToBadgework = () => { if (selectedIds.length) { setError(""); setMessage(""); setWorkflowStep("badgework"); } };
  const changeMembers = () => requestDiscardAction({ kind: "members" });
  const progressSource = sourceContext ? { type: sourceContext.sourceType, id: sourceContext.sourceId } : { type: "manual" as const };
  const updateRequirementDraft = (requirementId: string, completed: boolean) => { setError(""); setMessage(""); setDraft((current) => setDraftRequirement(current, requirementId, completed)); };
  const completeStageInDraft = () => { if (stage && selectedIds.length) { setError(""); setMessage(""); setDraft((current) => completeStageDraft(current, stage.requirements.map((requirement) => requirement.id))); } };

  const saveChanges = async () => {
    if (!selectedIds.length || !draft.size) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await Promise.all([...draft.entries()].map(([requirementId, completed]) => setRequirementCompletionForMembers(selectedIds, requirementId, completed, progressSource)));
      await refreshProgress(selectedIds);
      const changeCount = draft.size;
      setDraft(new Map());
      setMessage(`${changeCount} badgework ${changeCount === 1 ? "change" : "changes"} saved for ${selectedIds.length} selected ${selectedIds.length === 1 ? "child" : "children"}.`);
    } catch (saveError) {
      console.error("Unable to save badgework changes:", saveError);
      setError("Unable to save badgework changes. Your unsaved selections are still shown; please try again.");
    } finally { setSaving(false); }
  };

  const setAward = async (awarded: boolean) => {
    if (!skill || !stage || !selectedIds.length) return;
    if (awarded && !canAward) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await setStageAwardForMembers(selectedIds, skill.id, stage.stage, awarded);
      await refreshProgress(selectedIds);
      setMessage(awarded ? `Stage ${stage.stage} ${skill.name} awarded to ${selectedIds.length} selected ${selectedIds.length === 1 ? "child" : "children"}.` : `Stage ${stage.stage} ${skill.name} award removed.`);
    } catch (awardError) {
      console.error("Unable to update award:", awardError);
      setError("Unable to update the badge award. Please try again.");
    } finally { setSaving(false); }
  };

  const allVisibleSelected = visibleMembers.length > 0 && visibleMembers.every((member) => selectedIds.includes(member.id));
  const someVisibleSelected = visibleMembers.some((member) => selectedIds.includes(member.id)) && !allVisibleSelected;

  return <>
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}><Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Adventure Skills Badgework" description="Choose the children first, then record and save their Adventure Skills competency changes." />
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }} useFlexGap>
        <Chip color={workflowStep === "members" ? "secondary" : "success"} label="1. Select members" />
        <Chip color={workflowStep === "badgework" ? "secondary" : "default"} label="2. Badgework & save" />
      </Stack>
      {sourceContext && <Alert severity="info" sx={{ mb: 2 }} action={<Button component="a" href={sourceContext.returnTo} color="inherit" size="small">Back to {sourceLabel(sourceContext.sourceType)}</Button>}>Recording badgework from {sourceLabel(sourceContext.sourceType)}. The attending children have been preselected; confirm the members before continuing.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

      {loading ? <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : <>
        {workflowStep === "members" && <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h5" color="secondary" sx={{ fontWeight: 800, mb: .75 }}>Select members</Typography>
          <Typography color="text.secondary" sx={{ mb: 2.5 }}>Choose the child or children whose badgework you want to update, then continue to the competency screen.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2, mb: 2 }}>
            <TextField label="Search children" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or section" />
            <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={section} onChange={(event) => setSection(event.target.value)}>{sections.map((item) => <MenuItem key={item} value={item}>{item === "all" ? "All sections" : item}</MenuItem>)}</Select></FormControl>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2, alignItems: { sm: "center" } }}>
            <FormControlLabel control={<Checkbox checked={allVisibleSelected} indeterminate={someVisibleSelected} onChange={toggleAllVisible} />} label="Select all shown" />
            <Chip color={selectedIds.length ? "success" : "default"} label={selectedMemberSummary(selectedIds, visibleMembers.length)} />
            {selectedIds.length > 0 && <Button size="small" onClick={clearSelection}>Clear selection</Button>}
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
            {visibleMembers.map((member) => <Paper key={member.id} variant="outlined" sx={{ p: 1.25 }}><FormControlLabel sx={{ m: 0, width: "100%", alignItems: "flex-start" }} control={<Checkbox checked={selectedIds.includes(member.id)} onChange={() => toggleMember(member.id)} />} label={<Box sx={{ pt: .75 }}><Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography><Typography variant="body2" color="text.secondary">{member.section}</Typography></Box>} /></Paper>)}
          </Box>
          {visibleMembers.length === 0 && <Alert severity="info" sx={{ mt: 2 }}>No active children match the current filters.</Alert>}
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}><Button variant="contained" color="success" size="large" disabled={!selectedIds.length} onClick={continueToBadgework}>Select {selectedIds.length || ""} {selectedIds.length === 1 ? "member" : "members"} and continue</Button></Box>
        </Paper>}

        {workflowStep === "badgework" && <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" }, mb: 2.5 }}><Box><Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Record badgework</Typography><Typography color="text.secondary">Changes below are drafts until you select Save changes.</Typography></Box><Button variant="outlined" onClick={changeMembers}>Change members</Button></Stack>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 3 }}><Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography sx={{ fontWeight: 800 }}>{selectedIds.length} selected:</Typography>{selectedMembers.map((member) => <Chip key={member.id} size="small" label={`${member.displayName} · ${member.section}`} />)}</Stack></Paper>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr auto" }, gap: 2, alignItems: "center", mb: 3 }}>
            <FormControl fullWidth><InputLabel>Adventure Skill</InputLabel><Select label="Adventure Skill" value={skill?.id ?? ""} onChange={(event) => changeSkill(event.target.value)}>{adventureSkills.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</Select></FormControl>
            <FormControl fullWidth><InputLabel>Stage</InputLabel><Select label="Stage" value={stage?.stage ?? 1} onChange={(event) => changeStage(Number(event.target.value))}>{skill?.stages.map((item) => <MenuItem key={item.stage} value={item.stage}>Stage {item.stage}</MenuItem>)}</Select></FormControl>
            <Button variant="outlined" color="success" disabled={saving} onClick={completeStageInDraft} sx={{ minHeight: 48, whiteSpace: "nowrap" }}>Mark full stage complete</Button>
          </Box>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }} data-testid="badge-award-panel">
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
              <Box><Typography sx={{ fontWeight: 800 }}>Stage {stage?.stage} award</Typography><Typography variant="body2" color="text.secondary">Requirements complete and badge awarded are separate records.</Typography><Stack direction="row" spacing={1} sx={{ mt: 1 }}><Chip size="small" color={incompleteMemberIds.length === 0 ? "success" : "default"} label={incompleteMemberIds.length === 0 ? "Requirements complete" : `${incompleteMemberIds.length} selected incomplete`} /><Chip size="small" color={awardState === "all" ? "success" : awardState === "some" ? "warning" : "default"} label={awardState === "all" ? "Awarded" : awardState === "some" ? "Awarded to some" : "Not awarded"} /></Stack></Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button variant="contained" color="success" disabled={saving || !canAward || awardState === "all"} onClick={() => void setAward(true)}>Award badge</Button><Button variant="outlined" color="warning" disabled={saving || awardState === "none" || hasUnsavedChanges} onClick={() => setAwardRemovalOpen(true)}>Remove award</Button></Stack>
            </Stack>
            {hasUnsavedChanges && <Alert severity="info" sx={{ mt: 1.5 }}>Save competency changes before awarding or removing an award.</Alert>}
            {!hasUnsavedChanges && incompleteMemberIds.length > 0 && <Alert severity="info" sx={{ mt: 1.5 }}>The badge can be awarded once all competency points are saved as complete for every selected child.</Alert>}
          </Paper>

          {hasUnsavedChanges && <Alert severity="warning" sx={{ mb: 2 }}>You have {draft.size} unsaved badgework {draft.size === 1 ? "change" : "changes"}. Review the competency points below, then save.</Alert>}
          <Stack spacing={1.25}>{stage?.requirements.map((requirement) => {
            const persistedState = requirementSelectionState(selectedIds, progressByMemberId, requirement.id);
            const state = draftSelectionState(draft, requirement.id, persistedState);
            const changed = draft.has(requirement.id);
            const provenance = selectedIds.length === 1 ? requirementProvenance(singleProgress, requirement.id) : null;
            return <Paper key={requirement.id} variant="outlined" sx={{ p: 1.5 }}><FormControlLabel disabled={saving} sx={{ m: 0, width: "100%", alignItems: "flex-start" }} control={<Checkbox checked={state === "all"} indeterminate={state === "some"} onChange={(_, checked) => updateRequirementDraft(requirement.id, checked)} />} label={<Box sx={{ pt: .6 }}>
              <Typography>{requirement.statement}</Typography>
              {changed && <Typography variant="caption" color="warning.dark" sx={{ display: "block", fontWeight: 700 }}>Unsaved change</Typography>}
              {requirement.sharedCompetencyKey && <Typography variant="caption" color="success.dark" sx={{ display: "block", fontWeight: 700 }}>Shared competency · saving this also updates equivalent badgework.</Typography>}
              {state === "some" && <Typography variant="caption" color="warning.dark" sx={{ display: "block" }}>Completed by some selected children. Tick to complete for all selected children.</Typography>}
              {provenance && !changed && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .5 }} data-testid={`provenance-${requirement.id}`}>Completed {displayDate(provenance.completedAt)} · {sourceLabel(provenance.sourceType)}{provenance.sourceId && provenance.sourceType !== "manual" && provenance.sourceType !== "migration" ? <> · <a href={sourceBacklink(provenance.sourceType, provenance.sourceId)}>View source</a></> : null}</Typography>}
            </Box>} /></Paper>;
          })}</Stack>
          {selectedIds.length > 1 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Completion source details are shown when one child is selected, so provenance is never attributed ambiguously across a group.</Typography>}

          <Paper variant="outlined" sx={{ mt: 3, p: 2 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}><Box><Typography sx={{ fontWeight: 800 }}>{hasUnsavedChanges ? `${draft.size} unsaved ${draft.size === 1 ? "change" : "changes"}` : "No unsaved changes"}</Typography><Typography variant="body2" color="text.secondary">Nothing is written to the member records until you save.</Typography></Box><Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1}><Button disabled={saving || !hasUnsavedChanges} onClick={discardDraft}>Discard</Button><Button variant="contained" color="success" disabled={saving || !hasUnsavedChanges} onClick={() => void saveChanges()}>{saving ? "Saving…" : "Save changes"}</Button></Stack></Stack></Paper>
        </Paper>}
      </>}
    </Container></Box>

    <Dialog open={Boolean(pendingDiscard)} onClose={() => setPendingDiscard(null)} aria-labelledby="discard-badgework-title" fullWidth maxWidth="sm">
      <DialogTitle id="discard-badgework-title">Discard unsaved badgework changes?</DialogTitle>
      <DialogContent>
        <Typography>You have {draft.size} unsaved badgework {draft.size === 1 ? "change" : "changes"}. Continuing will discard those draft selections without writing them to any member record.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPendingDiscard(null)}>Keep editing</Button>
        <Button color="warning" variant="contained" onClick={confirmDiscardAction}>Discard and continue</Button>
      </DialogActions>
    </Dialog>

    <Dialog open={awardRemovalOpen} onClose={saving ? undefined : () => setAwardRemovalOpen(false)} aria-labelledby="remove-badge-award-title" fullWidth maxWidth="sm">
      <DialogTitle id="remove-badge-award-title">Remove stage award?</DialogTitle>
      <DialogContent>
        <Typography>Remove the Stage {stage?.stage} {skill?.name} award for the selected {selectedIds.length === 1 ? "child" : `${selectedIds.length} children`}? Saved competency progress will remain unchanged.</Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={() => setAwardRemovalOpen(false)}>Cancel</Button>
        <Button color="warning" variant="contained" disabled={saving} onClick={() => { setAwardRemovalOpen(false); void setAward(false); }}>Remove award</Button>
      </DialogActions>
    </Dialog>
  </>;
}
