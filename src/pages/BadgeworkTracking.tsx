import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { adventureSkills } from "../data/adventureSkills/index.ts";
import { loadMembers, type MemberRecord } from "../services/memberAdmin";
import {
  loadMemberAdventureProgress,
  setRequirementCompletionForMembers,
  type MemberAdventureProgress
} from "../services/adventureSkillProgress.ts";
import { completeStageDraft, draftSelectionState, setDraftRequirement } from "../services/adventureSkillDraftLogic.ts";
import { requirementSelectionState, selectedMemberSummary } from "../services/adventureSkillSelectionLogic.ts";
import { badgeworkSourceContextFromParams, sourceLabel } from "../services/adventureSkillSourceContext.ts";

export default function BadgeworkTracking() {
  const [searchParams] = useSearchParams();
  const sourceContext = useMemo(() => badgeworkSourceContextFromParams(searchParams), [searchParams]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sourceSelectionApplied, setSourceSelectionApplied] = useState(false);
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

  const skill = adventureSkills.find((item) => item.id === skillId) ?? adventureSkills[0];
  const stage = skill?.stages.find((item) => item.stage === stageNumber) ?? skill?.stages[0];
  const hasUnsavedChanges = draft.size > 0;

  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);
  const sections = useMemo(() => ["all", ...new Set(activeMembers.map((member) => member.section).filter(Boolean))], [activeMembers]);
  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeMembers.filter((member) =>
      (section === "all" || member.section === section) &&
      (!query || `${member.displayName} ${member.section}`.toLowerCase().includes(query))
    );
  }, [activeMembers, search, section]);

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
      try {
        setMembers(await loadMembers());
      } catch (loadError) {
        console.error("Unable to load badgework members:", loadError);
        setError("Unable to load children for badgework tracking.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!sourceContext || sourceSelectionApplied || activeMembers.length === 0) return;
    const allowed = new Set(activeMembers.map((member) => member.id));
    setSelectedIds(sourceContext.memberIds.filter((memberId) => allowed.has(memberId)));
    setSourceSelectionApplied(true);
  }, [activeMembers, sourceContext, sourceSelectionApplied]);

  useEffect(() => {
    void refreshProgress(selectedIds).catch((loadError) => {
      console.error("Unable to load Adventure Skills progress:", loadError);
      setError("Unable to load Adventure Skills progress.");
    });
  }, [selectedIds.join("|")]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const confirmDiscard = () => !hasUnsavedChanges || window.confirm("You have unsaved badgework changes. Discard them?");

  const discardDraft = () => {
    setDraft(new Map());
    setMessage("");
  };

  const changeSkill = (nextSkillId: string) => {
    if (!confirmDiscard()) return;
    const nextSkill = adventureSkills.find((item) => item.id === nextSkillId);
    setDraft(new Map());
    setSkillId(nextSkillId);
    setStageNumber(nextSkill?.stages[0]?.stage ?? 1);
    setMessage("");
  };

  const changeStage = (nextStage: number) => {
    if (!confirmDiscard()) return;
    setDraft(new Map());
    setStageNumber(nextStage);
    setMessage("");
  };

  const toggleMember = (memberId: string) => {
    if (!confirmDiscard()) return;
    setDraft(new Map());
    setMessage("");
    setSelectedIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
  };

  const toggleAllVisible = () => {
    if (!confirmDiscard()) return;
    setDraft(new Map());
    setMessage("");
    const visibleIds = visibleMembers.map((member) => member.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => allSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const clearSelection = () => {
    if (!confirmDiscard()) return;
    setDraft(new Map());
    setMessage("");
    setSelectedIds([]);
  };

  const progressSource = sourceContext
    ? { type: sourceContext.sourceType, id: sourceContext.sourceId }
    : { type: "manual" as const };

  const updateRequirementDraft = (requirementId: string, completed: boolean) => {
    if (selectedIds.length === 0) return;
    setError("");
    setMessage("");
    setDraft((current) => setDraftRequirement(current, requirementId, completed));
  };

  const completeStageInDraft = () => {
    if (!stage || selectedIds.length === 0) return;
    setError("");
    setMessage("");
    setDraft((current) => completeStageDraft(current, stage.requirements.map((requirement) => requirement.id)));
  };

  const saveChanges = async () => {
    if (selectedIds.length === 0 || draft.size === 0) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await Promise.all([...draft.entries()].map(([requirementId, completed]) =>
        setRequirementCompletionForMembers(selectedIds, requirementId, completed, progressSource)
      ));
      await refreshProgress(selectedIds);
      const changeCount = draft.size;
      setDraft(new Map());
      setMessage(`${changeCount} badgework ${changeCount === 1 ? "change" : "changes"} saved for ${selectedIds.length} selected ${selectedIds.length === 1 ? "child" : "children"}.`);
    } catch (saveError) {
      console.error("Unable to save badgework changes:", saveError);
      setError("Unable to save badgework changes. Your unsaved selections are still shown; please try again.");
    } finally {
      setSaving(false);
    }
  };

  const allVisibleSelected = visibleMembers.length > 0 && visibleMembers.every((member) => selectedIds.includes(member.id));
  const someVisibleSelected = visibleMembers.some((member) => selectedIds.includes(member.id)) && !allVisibleSelected;

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader
        title="Adventure Skills Badgework"
        description="Select one or more children, mark the competency changes you want, then save them together. Shared competencies automatically carry across linked Adventure Skills."
      />

      {sourceContext && <Alert severity="info" sx={{ mb: 2 }} action={<Button component="a" href={sourceContext.returnTo} color="inherit" size="small">Back to {sourceLabel(sourceContext.sourceType)}</Button>}>
        Recording badgework from {sourceLabel(sourceContext.sourceType)}. Saved competency points keep this source link in the child&apos;s Adventure Skills progress.
      </Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

      {loading ? <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : <>
        <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
          <Typography variant="h6" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>1. Select children</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2, mb: 2 }}>
            <TextField label="Search children" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or section" />
            <FormControl>
              <InputLabel>Section</InputLabel>
              <Select label="Section" value={section} onChange={(event) => setSection(event.target.value)}>
                {sections.map((item) => <MenuItem key={item} value={item}>{item === "all" ? "All sections" : item}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2, alignItems: { sm: "center" } }}>
            <FormControlLabel control={<Checkbox checked={allVisibleSelected} indeterminate={someVisibleSelected} onChange={toggleAllVisible} />} label="Select all shown" />
            <Chip color={selectedIds.length ? "success" : "default"} label={selectedMemberSummary(selectedIds, visibleMembers.length)} />
            {selectedIds.length > 0 && <Button size="small" onClick={clearSelection}>Clear selection</Button>}
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
            {visibleMembers.map((member) => <Paper key={member.id} variant="outlined" sx={{ p: 1.25 }}>
              <FormControlLabel
                sx={{ m: 0, width: "100%", alignItems: "flex-start" }}
                control={<Checkbox checked={selectedIds.includes(member.id)} onChange={() => toggleMember(member.id)} />}
                label={<Box sx={{ pt: 0.75 }}><Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography><Typography variant="body2" color="text.secondary">{member.section}</Typography></Box>}
              />
            </Paper>)}
          </Box>
          {visibleMembers.length === 0 && <Alert severity="info">No active children match the current filters.</Alert>}
        </Paper>

        <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>2. Record badgework</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr auto" }, gap: 2, alignItems: "center", mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Adventure Skill</InputLabel>
              <Select label="Adventure Skill" value={skill?.id ?? ""} onChange={(event) => changeSkill(event.target.value)}>
                {adventureSkills.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Stage</InputLabel>
              <Select label="Stage" value={stage?.stage ?? 1} onChange={(event) => changeStage(Number(event.target.value))}>
                {skill?.stages.map((item) => <MenuItem key={item.stage} value={item.stage}>Stage {item.stage}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="outlined" color="success" disabled={saving || selectedIds.length === 0} onClick={completeStageInDraft} sx={{ minHeight: 48, whiteSpace: "nowrap" }}>Mark full stage complete</Button>
          </Box>

          {selectedIds.length === 0 && <Alert severity="info" sx={{ mb: 2 }}>Select at least one child before recording badgework.</Alert>}
          {hasUnsavedChanges && <Alert severity="warning" sx={{ mb: 2 }}>
            You have {draft.size} unsaved badgework {draft.size === 1 ? "change" : "changes"}. Review the competency points below, then select Save changes.
          </Alert>}

          <Stack spacing={1.25}>
            {stage?.requirements.map((requirement) => {
              const persistedState = requirementSelectionState(selectedIds, progressByMemberId, requirement.id);
              const state = draftSelectionState(draft, requirement.id, persistedState);
              const changed = draft.has(requirement.id);
              return <Paper key={requirement.id} variant="outlined" sx={{ p: 1.5 }}>
                <FormControlLabel
                  disabled={saving || selectedIds.length === 0}
                  sx={{ m: 0, width: "100%", alignItems: "flex-start" }}
                  control={<Checkbox checked={state === "all"} indeterminate={state === "some"} onChange={(_, checked) => updateRequirementDraft(requirement.id, checked)} />}
                  label={<Box sx={{ pt: 0.6 }}>
                    <Typography>{requirement.statement}</Typography>
                    {changed && <Typography variant="caption" color="warning.dark" sx={{ display: "block", fontWeight: 700 }}>Unsaved change</Typography>}
                    {requirement.sharedCompetencyKey && <Typography variant="caption" color="success.dark" sx={{ display: "block", fontWeight: 700 }}>Shared competency · saving this also updates equivalent badgework.</Typography>}
                    {state === "some" && <Typography variant="caption" color="warning.dark" sx={{ display: "block" }}>Completed by some selected children. Tick to complete for all selected children.</Typography>}
                  </Box>}
                />
              </Paper>;
            })}
          </Stack>

          <Paper variant="outlined" sx={{ mt: 3, p: 2, position: { xs: "sticky", md: "static" }, bottom: { xs: 8, md: "auto" }, zIndex: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>{hasUnsavedChanges ? `${draft.size} unsaved ${draft.size === 1 ? "change" : "changes"}` : "No unsaved changes"}</Typography>
                <Typography variant="body2" color="text.secondary">Competency changes are only written to the member records when you save.</Typography>
              </Box>
              <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1}>
                <Button disabled={saving || !hasUnsavedChanges} onClick={discardDraft}>Discard</Button>
                <Button variant="contained" color="success" disabled={saving || !hasUnsavedChanges || selectedIds.length === 0} onClick={() => void saveChanges()}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Paper>
      </>}
    </Container>
  </Box>;
}
