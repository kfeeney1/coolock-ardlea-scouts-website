import { saveAdventureSkillDraft } from "../services/adventureSkillDraftSave.ts";
import { useBadgeworkMeetingAttendance } from "../hooks/useBadgeworkMeetingAttendance";
import { useBadgeworkExperience } from "../hooks/useBadgeworkExperience";
import BadgeworkLeaveGuard from "../components/admin/BadgeworkLeaveGuard";
import BadgeworkRecordPanel from "../components/admin/BadgeworkRecordPanel";
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
  Alert, Box, Button, CircularProgress, Container
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
  const experience = useBadgeworkExperience();
  const [searchParams] = useSearchParams();
  const sourceContext = useMemo(() => badgeworkSourceContextFromParams(searchParams), [searchParams]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sourceSelectionAppliedFor, setSourceSelectionAppliedFor] = useState<string | null>(null);
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
  const sourceSelectionKey = sourceContext ? `${sourceContext.sourceType}:${sourceContext.sourceId}:${sourceContext.memberIds.join(",")}` : null;
  const sourceSelectionApplied = sourceSelectionKey !== null && sourceSelectionAppliedFor === sourceSelectionKey;

  const skill = adventureSkills.find((item) => item.id === skillId) ?? adventureSkills[0];
  const stage = skill?.stages.find((item) => item.stage === stageNumber) ?? skill?.stages[0];
  const unsavedChangeCount = draft.size + memberDraft.size;
  const hasUnsavedChanges = unsavedChangeCount > 0;
  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);
  const meetingSourceId = sourceContext?.sourceType === "weeklyMeeting" ? sourceContext.sourceId : null;
  const { meetingPresentMemberIds, meetingAttendanceLoading } = useBadgeworkMeetingAttendance(meetingSourceId, setSelectedIds, setError);
  const meetingMembers = useMemo(() => sourceContext?.sourceType === "weeklyMeeting" && meetingPresentMemberIds
    ? activeMembers.filter((member) => meetingPresentMemberIds.has(member.id))
    : activeMembers, [activeMembers, meetingPresentMemberIds, sourceContext]);
  const { progressByMemberId, overviewLoaded, setOverviewLoaded, overviewError, setOverviewError, refreshProgress } = useBadgeworkProgress(activeMembers, loading, mode, workflowStep, selectedIds, setError);
  const overviewLoading = !loading && mode === "overview" && !overviewLoaded && !overviewError && activeMembers.length > 0;
  const selectionMembers = sourceContext?.sourceType === "weeklyMeeting" ? meetingMembers : activeMembers;
  const sections = useMemo(() => sectionFilterOptions(selectionMembers.map((member) => member.section)), [selectionMembers]);
  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return selectionMembers.filter((member) => (section === "all" || member.section === section) && (!query || `${member.displayName} ${member.section}`.toLowerCase().includes(query)));
  }, [selectionMembers, search, section]);
  const selectedMembers = useMemo(() => selectionMembers.filter((member) => selectedIds.includes(member.id)), [selectionMembers, selectedIds]);
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
    if (!sourceContext || sourceSelectionApplied || activeMembers.length === 0 || (sourceContext.sourceType === "weeklyMeeting" && (meetingAttendanceLoading || !meetingPresentMemberIds))) return;
    const allowed = new Set((sourceContext.sourceType === "weeklyMeeting" ? meetingMembers : activeMembers).map((member) => member.id));
    setSelectedIds(sourceContext.memberIds.filter((memberId) => allowed.has(memberId)));
    setSourceSelectionAppliedFor(sourceSelectionKey);
  }, [activeMembers, meetingAttendanceLoading, meetingMembers, meetingPresentMemberIds, sourceContext, sourceSelectionApplied, sourceSelectionKey]);


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
  const openRecordMode = () => { if (experience.redesigned && hasUnsavedChanges) { setPendingDiscard({ kind: "members" }); return; } setMode("record"); setWorkflowStep("members"); setMessage(""); setError(""); };
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
    if (!selectedIds.length || !hasUnsavedChanges) return false;
    setSaving(true); setError(""); setMessage("");
    try {
      if (experience.redesigned) await saveAdventureSkillDraft(selectedIds, draft, memberDraft, progressSource);
      else {
      await Promise.all([...draft.entries()].map(([requirementId, completed]) => setRequirementCompletionForMembers(selectedIds, requirementId, completed, progressSource)));
      const individualChanges = memberRequirementDraftChanges(memberDraft);
      await Promise.all(individualChanges.map((change) => setRequirementCompletionForMembers([change.memberId], change.requirementId, change.completed, progressSource)));
      }
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
      return true;
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Unable to save badgework changes. Your unsaved selections are still shown; please try again.", "BadgeworkTracking"));
      return false;
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
    ? <BadgeworkSelectedMemberStageSummary redesigned={experience.redesigned} disabled={saving} groupDraft={draft} memberDraft={memberDraft} members={selectedMembers} onMemberRequirementChange={updateMemberRequirementDraft} progressByMemberId={progressByMemberId} skill={skill} stage={stage} />
    : null;
  const groupCompetencyControls = <BadgeworkGroupCompetencyControls redesigned={experience.redesigned} memberDraft={memberDraft} disabled={saving} draft={draft} onRequirementChange={updateRequirementDraft} progressByMemberId={progressByMemberId} selectedMemberIds={selectedIds} stage={stage} unsavedChangeCount={unsavedChangeCount} />;
  const savePanel = <BadgeworkSavePanel disabled={saving} onDiscard={discardDraft} onSave={() => void saveChanges()} onSaveAndReturn={sourceContext ? () => void saveChanges(true) : undefined} returnLabel={sourceContext ? sourceLabel(sourceContext.sourceType) : undefined} saving={saving} unsavedChangeCount={unsavedChangeCount} />;

  return <>
    <Box data-testid="badgework-experience" data-experience={experience.redesigned ? "redesigned" : "existing"} sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}><Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Adventure Skills Badgework" description="Choose the children first, then record and save their Adventure Skills competency changes." />
      <BadgeworkModeNavigation disabled={experience.redesigned && saving} redesigned={experience.redesigned} mode={mode} step={workflowStep} onOverview={openOverviewMode} onRecord={openRecordMode} />
      {experience.changed && <Alert severity="info" sx={{ mb: 2 }}>The badgework layout setting changed. This visit keeps its current layout and edits. Save or discard changes before reloading.</Alert>}
      {sourceContext && <Alert severity="info" sx={{ mb: 2 }} action={<Button component="a" href={sourceContext.returnTo} color="inherit" size="small">Back to {sourceLabel(sourceContext.sourceType)}</Button>}>Recording badgework from {sourceLabel(sourceContext.sourceType)}. The attending children have been preselected; confirm the members before continuing.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

      {loading || meetingAttendanceLoading || !experience.ready ? <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : <>
        {mode === "overview" && <BadgeworkOverview redesigned={experience.redesigned} activeMemberCount={activeMembers.length} error={overviewError} loaded={overviewLoaded || (!loading && !error && activeMembers.length === 0)} loading={overviewLoading} members={visibleMembers} onOpenMemberSkill={openMemberSkill} onRetry={() => { setOverviewLoaded(false); setOverviewError(""); }} onSearchChange={setSearch} onSectionChange={setSection} progressByMemberId={progressByMemberId} search={search} section={section} sections={sections} />}



        {mode === "record" && workflowStep === "members" && <BadgeworkMemberSelection search={search} section={section} sections={sections} visibleMembers={visibleMembers} selectedIds={selectedIds} allVisibleSelected={allVisibleSelected} someVisibleSelected={someVisibleSelected} onSearchChange={setSearch} onSectionChange={setSection} onToggleAllVisible={toggleAllVisible} onClearSelection={clearSelection} onToggleMember={toggleMember} onContinue={continueToBadgework} />}

        {mode === "record" && workflowStep === "badgework" && <BadgeworkRecordPanel
          autoFocusSkill={experience.redesigned} members={selectedMembers} selectedCount={selectedIds.length} fromSource={Boolean(sourceContext)} skill={skill} saving={saving}
          onChangeMembers={changeMembers} onChangeSkill={changeSkill} onCompleteStage={completeStageInDraft}
          stageNavigation={skill && <Box sx={{ mb: 3 }}><BadgeworkStageNavigation currentStage={stage?.stage ?? 1} disabled={saving} onChange={changeStage} progressByMemberId={progressByMemberId} selectedMemberIds={selectedIds} skill={skill} /></Box>}
          selectedStageSummary={selectedStageSummary} groupCompetencyControls={groupCompetencyControls} savePanel={savePanel}
          awardPanel={<BadgeworkAwardPanel stageNumber={stage?.stage} incompleteCount={incompleteMemberIds.length} awardState={awardState} saving={saving} canAward={canAward} hasUnsavedChanges={hasUnsavedChanges} onAward={() => void setAward(true)} onRemove={() => setAwardRemovalOpen(true)} />}
        />}
      </>}
    </Container></Box>

    {experience.redesigned && <BadgeworkLeaveGuard dirty={hasUnsavedChanges} saving={saving} save={saveChanges} />}
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
