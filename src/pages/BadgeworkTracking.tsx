import BadgeworkMemberSelection from "../components/admin/BadgeworkMemberSelection.tsx";
import BadgeworkAwardPanel from "../components/admin/BadgeworkAwardPanel.tsx";
import { useBadgeworkProgress } from "../components/admin/useBadgeworkProgress.ts";
import { applicationErrorMessage } from "../services/applicationErrors.ts";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import BadgeworkOverview from "../components/admin/BadgeworkOverview.tsx";
import BadgeworkModeNavigation from "../components/admin/BadgeworkModeNavigation.tsx";
import BadgeworkStageNavigation from "../components/admin/BadgeworkStageNavigation.tsx";
import BadgeworkSelectedMemberStageSummary from "../components/admin/BadgeworkSelectedMemberStageSummary.tsx";
import BadgeworkGroupCompetencyControls from "../components/admin/BadgeworkGroupCompetencyControls.tsx";
import BadgeworkSavePanel from "../components/admin/BadgeworkSavePanel.tsx";
import BadgeworkTrackingDialogs from "../components/admin/BadgeworkTrackingDialogs.tsx";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, Container,
  FormControl, InputLabel, MenuItem, Paper,
  Select, Stack, Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { adventureSkills } from "../data/adventureSkills/index.ts";
import { loadMembers, type MemberRecord } from "../services/memberAdmin";
import {
  setRequirementCompletionForMembers,
  setStageAwardForMembers
} from "../services/adventureSkillProgress.ts";
import { completeStageDraft, setDraftRequirement } from "../services/adventureSkillDraftLogic.ts";
import { membersWithIncompleteStage, stageAwardSelectionState } from "../services/adventureSkillAwardLogic.ts";
import { badgeworkSourceContextFromParams, sourceLabel } from "../services/adventureSkillSourceContext.ts";
import {
  clearMemberRequirementDraftForRequirement,
  memberRequirementCompletion,
  memberRequirementDraftChanges,
  setMemberRequirementDraft
} from "../services/adventureSkillMemberDraftLogic.ts";
import { sectionFilterOptions } from "../services/sectionOrder.ts";

type BadgeworkStep = "members" | "badgework";
type BadgeworkMode = "overview" | "record";
type DiscardAction = { kind: "skill"; skillId: string } | { kind: "stage"; stage: number } | { kind: "members" } | { kind: "overview" };

export default function BadgeworkTracking() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceContext = useMemo(() => badgeworkSourceContextFromParams(searchParams), [searchParams]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sourceSelectionApplied, setSourceSelectionApplied] = useState(false);
  const [mode, setMode] = useState<BadgeworkMode>(sourceContext ? "record" : "overview");
  const [workflowStep, setWorkflowStep] = useState<BadgeworkStep>("members");
  const [skillId, setSkillId] = useState(adventureSkills[0]?.id ?? "");
  const [stageNumber, setStageNumber] = useState(1);
  const [section, setSection] = useState("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(new Map<string, boolean>());
  const [memberDraft, setMemberDraft] = useState(new Map<string, boolean>());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDiscard, setPendingDiscard] = useState<DiscardAction | null>(null);
  const [awardRemovalOpen, setAwardRemovalOpen] = useState(false);

  const skill = adventureSkills.find((item) => item.id === skillId) ?? adventureSkills[0];
  const stage = skill?.stages.find((item) => item.stage === stageNumber) ?? skill?.stages[0];
  const unsavedChangeCount = draft.size + memberDraft.size;
  const hasUnsavedChanges = unsavedChangeCount > 0;
  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);
  const { progressByMemberId, overviewLoaded, setOverviewLoaded, overviewError, setOverviewError, refreshProgress } = useBadgeworkProgress(activeMembers, loading, mode, workflowStep, selectedIds, setError);
  const overviewLoading = !loading && mode === "overview" && !overviewLoaded && !overviewError && activeMembers.length > 0;
  const sections = useMemo(() => sectionFilterOptions(activeMembers.map((member) => member.section)), [activeMembers]);
  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeMembers.filter((member) => (section === "all" || member.section === section) && (!query || `${member.displayName} ${member.section}`.toLowerCase().includes(query)));
  }, [activeMembers, search, section]);
  const selectedMembers = useMemo(() => activeMembers.filter((member) => selectedIds.includes(member.id)), [activeMembers, selectedIds]);
  const awardState = skill && stage ? stageAwardSelectionState(selectedIds, progressByMemberId, skill.id, stage.stage) : "none";
  const incompleteMemberIds = skill && stage ? membersWithIncompleteStage(selectedIds, progressByMemberId, skill.id, stage.stage) : selectedIds;
  const canAward = selectedIds.length > 0 && incompleteMemberIds.length === 0 && !hasUnsavedChanges;


  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loadedMembers = await loadMembers();
        if (active) setMembers(loadedMembers);
      } catch (loadError) {
        if (active) setError(applicationErrorMessage(loadError, "Unable to load children for badgework tracking.", "BadgeworkTracking"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sourceContext || sourceSelectionApplied || activeMembers.length === 0) return;
    const allowed = new Set(activeMembers.map((member) => member.id));
    setSelectedIds(sourceContext.memberIds.filter((memberId) => allowed.has(memberId)));
    setSourceSelectionApplied(true);
  }, [activeMembers, sourceContext, sourceSelectionApplied]);


  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const discardDraft = () => { setDraft(new Map()); setMemberDraft(new Map()); setMessage(""); };
  const applyDiscardAction = (action: DiscardAction) => {
    discardDraft();
    if (action.kind === "skill") {
      const nextSkill = adventureSkills.find((item) => item.id === action.skillId);
      setSkillId(action.skillId);
      setStageNumber(nextSkill?.stages[0]?.stage ?? 1);
    } else if (action.kind === "stage") {
      setStageNumber(action.stage);
    } else if (action.kind === "members") {
      setWorkflowStep("members");
    } else {
      setMode("overview");
      setWorkflowStep("members");
      setSelectedIds([]);
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
  const openRecordMode = () => { setMode("record"); setWorkflowStep("members"); setMessage(""); setError(""); };
  const openOverviewMode = () => {
    if (hasUnsavedChanges) { setPendingDiscard({ kind: "overview" }); return; }
    setMode("overview"); setWorkflowStep("members"); setSelectedIds([]); setMessage(""); setError("");
  };
  const openMemberSkill = (memberId: string, nextSkillId: string, nextStage: number) => {
    setSelectedIds([memberId]);
    setSkillId(nextSkillId);
    setStageNumber(nextStage);
    setMode("record");
    setWorkflowStep("badgework");
    setMessage("");
    setError("");
  };
  const progressSource = sourceContext ? { type: sourceContext.sourceType, id: sourceContext.sourceId } : { type: "manual" as const };
  const updateRequirementDraft = (requirementId: string, completed: boolean) => {
    setError(""); setMessage("");
    setMemberDraft((current) => clearMemberRequirementDraftForRequirement(current, requirementId));
    setDraft((current) => setDraftRequirement(current, requirementId, completed));
  };
  const updateMemberRequirementDraft = (memberId: string, requirementId: string, completed: boolean) => {
    setError(""); setMessage("");
    const persisted = memberRequirementCompletion(progressByMemberId.get(memberId), requirementId);
    const baseline = draft.get(requirementId) ?? persisted;
    setMemberDraft((current) => setMemberRequirementDraft(current, memberId, requirementId, completed, baseline));
  };
  const completeStageInDraft = () => {
    if (!stage || !selectedIds.length) return;
    setError(""); setMessage("");
    const requirementIds = stage.requirements.map((requirement) => requirement.id);
    setMemberDraft((current) => requirementIds.reduce((next, requirementId) => clearMemberRequirementDraftForRequirement(next, requirementId), new Map(current)));
    setDraft((current) => completeStageDraft(current, requirementIds));
  };

  const saveChanges = async (returnToSource = false) => {
    if (!selectedIds.length || !hasUnsavedChanges) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await Promise.all([...draft.entries()].map(([requirementId, completed]) => setRequirementCompletionForMembers(selectedIds, requirementId, completed, progressSource)));
      const individualChanges = memberRequirementDraftChanges(memberDraft);
      await Promise.all(individualChanges.map((change) => setRequirementCompletionForMembers([change.memberId], change.requirementId, change.completed, progressSource)));
      const changeCount = unsavedChangeCount;
      setDraft(new Map());
      setMemberDraft(new Map());
      setMessage(`${changeCount} badgework ${changeCount === 1 ? "change" : "changes"} saved for ${selectedIds.length} selected ${selectedIds.length === 1 ? "child" : "children"}.`);
      try {
        await refreshProgress(selectedIds, undefined, true);
      } catch (loadError) {
        setError(applicationErrorMessage(loadError, "Badgework changes were saved, but the latest progress could not be reloaded. Refresh the page to see the saved state.", "BadgeworkTracking"));
      }
      if (returnToSource && sourceContext) navigate(sourceContext.returnTo);
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Unable to save badgework changes. Your unsaved selections are still shown; please try again.", "BadgeworkTracking"));
    } finally { setSaving(false); }
  };

  const setAward = async (awarded: boolean) => {
    if (!skill || !stage || !selectedIds.length) return;
    if (awarded && !canAward) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await setStageAwardForMembers(selectedIds, skill.id, stage.stage, awarded);
      setMessage(awarded ? `Stage ${stage.stage} ${skill.name} awarded to ${selectedIds.length} selected ${selectedIds.length === 1 ? "child" : "children"}.` : `Stage ${stage.stage} ${skill.name} award removed.`);
      try {
        await refreshProgress(selectedIds, undefined, true);
      } catch (loadError) {
        setError(applicationErrorMessage(loadError, "The badge award was updated, but the latest progress could not be reloaded. Refresh the page to see the saved state.", "BadgeworkTracking"));
      }
    } catch (awardError) {
      setError(applicationErrorMessage(awardError, "Unable to update the badge award. Please try again.", "BadgeworkTracking"));
    } finally { setSaving(false); }
  };

  const allVisibleSelected = visibleMembers.length > 0 && visibleMembers.every((member) => selectedIds.includes(member.id));
  const someVisibleSelected = visibleMembers.some((member) => selectedIds.includes(member.id)) && !allVisibleSelected;
  const selectedStageSummary = skill && stage && selectedMembers.length > 0
    ? <BadgeworkSelectedMemberStageSummary disabled={saving} groupDraft={draft} memberDraft={memberDraft} members={selectedMembers} onMemberRequirementChange={updateMemberRequirementDraft} progressByMemberId={progressByMemberId} skill={skill} stage={stage} />
    : null;
  const groupCompetencyControls = <BadgeworkGroupCompetencyControls disabled={saving} draft={draft} onRequirementChange={updateRequirementDraft} progressByMemberId={progressByMemberId} selectedMemberIds={selectedIds} stage={stage} unsavedChangeCount={unsavedChangeCount} />;
  const savePanel = <BadgeworkSavePanel disabled={saving} onDiscard={discardDraft} onSave={() => void saveChanges()} onSaveAndReturn={sourceContext ? () => void saveChanges(true) : undefined} returnLabel={sourceContext ? sourceLabel(sourceContext.sourceType) : undefined} saving={saving} unsavedChangeCount={unsavedChangeCount} />;

  return <>
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}><Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Adventure Skills Badgework" description="Choose the children first, then record and save their Adventure Skills competency changes." />
      <BadgeworkModeNavigation mode={mode} step={workflowStep} onOverview={openOverviewMode} onRecord={openRecordMode} />
      {sourceContext && <Alert severity="info" sx={{ mb: 2 }} action={<Button component="a" href={sourceContext.returnTo} color="inherit" size="small">Back to {sourceLabel(sourceContext.sourceType)}</Button>}>Recording badgework from {sourceLabel(sourceContext.sourceType)}. The attending children have been preselected; confirm the members before continuing.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

      {loading ? <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : <>
        {mode === "overview" && <BadgeworkOverview activeMemberCount={activeMembers.length} error={overviewError} loaded={overviewLoaded || (!loading && !error && activeMembers.length === 0)} loading={overviewLoading} members={visibleMembers} onOpenMemberSkill={openMemberSkill} onRetry={() => { setOverviewLoaded(false); setOverviewError(""); }} onSearchChange={setSearch} onSectionChange={setSection} progressByMemberId={progressByMemberId} search={search} section={section} sections={sections} />}



        {mode === "record" && workflowStep === "members" && <BadgeworkMemberSelection search={search} section={section} sections={sections} visibleMembers={visibleMembers} selectedIds={selectedIds} allVisibleSelected={allVisibleSelected} someVisibleSelected={someVisibleSelected} onSearchChange={setSearch} onSectionChange={setSection} onToggleAllVisible={toggleAllVisible} onClearSelection={clearSelection} onToggleMember={toggleMember} onContinue={continueToBadgework} />}

        {mode === "record" && workflowStep === "badgework" && <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" }, mb: 2.5 }}><Box><Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Record badgework</Typography><Typography color="text.secondary">Changes below are drafts until you select Save changes.</Typography></Box><Button variant="outlined" onClick={changeMembers}>Change members</Button></Stack>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 3 }}><Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography sx={{ fontWeight: 800 }}>{selectedIds.length} selected:</Typography>{selectedMembers.map((member) => <Chip key={member.id} size="small" label={`${member.displayName} · ${member.section}`} />)}</Stack></Paper>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) auto" }, gap: 2, alignItems: "center", mb: 2 }}>
            <FormControl fullWidth><InputLabel>Adventure Skill</InputLabel><Select label="Adventure Skill" value={skill?.id ?? ""} onChange={(event) => changeSkill(event.target.value)}>{adventureSkills.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</Select></FormControl>
            <Button variant="outlined" color="success" disabled={saving} onClick={completeStageInDraft} sx={{ minHeight: 48, whiteSpace: "nowrap" }}>Mark full stage complete</Button>
          </Box>
          {skill && <Box sx={{ mb: 3 }}><BadgeworkStageNavigation currentStage={stage?.stage ?? 1} disabled={saving} onChange={changeStage} progressByMemberId={progressByMemberId} selectedMemberIds={selectedIds} skill={skill} /></Box>}
          {!sourceContext && selectedStageSummary}
          {sourceContext && groupCompetencyControls}
          {sourceContext && selectedMembers.length > 1 && <Accordion disableGutters sx={{ mt: 2, mb: 2 }} data-testid="badgework-meeting-exceptions"><AccordionSummary expandIcon={<Typography component="span" aria-hidden="true">⌄</Typography>}><Box><Typography sx={{ fontWeight: 800 }}>Review individual progress and exceptions</Typography><Typography variant="body2" color="text.secondary">Open this only when selected children completed different competency points.</Typography></Box></AccordionSummary><AccordionDetails>{selectedStageSummary}</AccordionDetails></Accordion>}
          {sourceContext && selectedMembers.length === 1 && <Box sx={{ mt: 2 }}>{selectedStageSummary}</Box>}



          <BadgeworkAwardPanel stageNumber={stage?.stage} incompleteCount={incompleteMemberIds.length} awardState={awardState} saving={saving} canAward={canAward} hasUnsavedChanges={hasUnsavedChanges} onAward={() => void setAward(true)} onRemove={() => setAwardRemovalOpen(true)} />

          {!sourceContext && groupCompetencyControls}
          {savePanel}
        </Paper>}
      </>}
    </Container></Box>

    <BadgeworkTrackingDialogs
      pendingDiscard={Boolean(pendingDiscard)}
      unsavedChangeCount={unsavedChangeCount}
      onKeepEditing={() => setPendingDiscard(null)}
      onConfirmDiscard={confirmDiscardAction}
      awardRemovalOpen={awardRemovalOpen}
      saving={saving}
      stageNumber={stage?.stage}
      skillName={skill?.name}
      selectedMemberCount={selectedIds.length}
      onCancelAwardRemoval={() => setAwardRemovalOpen(false)}
      onConfirmAwardRemoval={() => { setAwardRemovalOpen(false); void setAward(false); }}
    />
  </>;
}
