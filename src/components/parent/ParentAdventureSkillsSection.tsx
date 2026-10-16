import { reportApplicationError } from "../../services/applicationErrors.ts";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import BadgeworkSkillGrid from "../admin/BadgeworkSkillGrid.tsx";
import {
  OperationalErrorState,
  OperationalLoading,
  OperationalPermissionState,
  OperationalUnavailableState
} from "../admin/OperationalStates";
import { loadLinkedMembers, type ParentLinkedMember } from "../../services/parentConsent";
import { loadMemberAdventureProgress, type MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import { parentAdventureSkillSummaries } from "../../services/parentAdventureSkillProgressLogic.ts";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../../services/firestoreErrors";

const stageStatus = (status: string) => status === "requirements-complete" ? "Requirements complete" : status === "awarded" ? "Awarded" : status === "in-progress" ? "In progress" : "Not started";

export default function ParentAdventureSkillsSection({ memberIds }: { memberIds: string[] }) {
  const [members, setMembers] = useState<ParentLinkedMember[]>([]);
  const [progressByMember, setProgressByMember] = useState(new Map<string, MemberAdventureProgress>());
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // The IDs come from the approved parent account and are rechecked by the
      // Firestore rules for every progress read, including direct-route loads.
      const linkedMembers = await loadLinkedMembers(memberIds);
      const progress = await Promise.all(linkedMembers.map((member) => loadMemberAdventureProgress(member.id)));
      setMembers(linkedMembers);
      setProgressByMember(new Map(progress.map((item) => [item.memberId, item])));
      setSelectedMemberId((current) => current && linkedMembers.some((member) => member.id === current) ? current : linkedMembers[0]?.id ?? "");
      setSelectedSkillId("");
    } catch (error) {
      reportApplicationError(error, { area: "ParentAdventureSkillsSection", operation: "Unable to load parent Adventure Skills progress" });
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [memberIds]);

  useEffect(() => { void load(); }, [load]);

  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const progress = selectedMember ? progressByMember.get(selectedMember.id) : undefined;
  const summaries = useMemo(() => progress ? parentAdventureSkillSummaries(progress) : [], [progress]);
  const selectedSkill = summaries.find((skill) => skill.skillId === selectedSkillId) ?? null;

  if (loading) return <OperationalLoading minHeight={180} label="Loading Adventure Skills progress" />;

  if (loadError) {
    const message = firestoreFailureMessage(loadError, "Unable to load Adventure Skills progress right now. Please try again.");
    if (classifyFirestoreFailure(loadError) === "permission") {
      return <OperationalPermissionState title="Adventure Skills access unavailable" actionLabel="Retry" onAction={() => void load()} testId="parent-adventure-skills-permission">{message}</OperationalPermissionState>;
    }
    return <OperationalErrorState title="Adventure Skills could not be loaded" actionLabel="Retry" onAction={() => void load()} testId="parent-adventure-skills-error">{message}</OperationalErrorState>;
  }

  if (members.length === 0) {
    return <OperationalUnavailableState title="Adventure Skills not available yet" testId="parent-adventure-skills-unavailable">No linked child record is available for Adventure Skills progress yet. Please ask a leader to review Parent Access.</OperationalUnavailableState>;
  }

  return <Stack spacing={2.5} data-testid="parent-adventure-skills">
    <Typography color="text.secondary">Adventure Skills progress is read-only here. Select a skill tile to view its stages and competency points.</Typography>

    {members.length > 1 && <FormControl fullWidth>
      <InputLabel id="parent-adventure-child-label">Child</InputLabel>
      <Select labelId="parent-adventure-child-label" label="Child" value={selectedMemberId} onChange={(event) => { setSelectedMemberId(event.target.value); setSelectedSkillId(""); }} data-testid="parent-adventure-child-select">
        {members.map((member) => <MenuItem key={member.id} value={member.id}>{member.displayName} · {member.section}</MenuItem>)}
      </Select>
    </FormControl>}

    {selectedMember && <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{selectedMember.displayName}</Typography>
        <Chip size="small" variant="outlined" label={selectedMember.section} />
        <Chip size="small" color="info" label="Read only" />
      </Stack>
    </Paper>}

    {selectedMember && !selectedSkill && <BadgeworkSkillGrid
      memberName={selectedMember.displayName}
      summaries={summaries}
      onOpenStage={(skillId) => setSelectedSkillId(skillId)}
    />}

    {selectedMember && selectedSkill && <Stack spacing={1.5} data-testid={`parent-adventure-skill-${selectedSkill.skillId}`}>
      <Button variant="outlined" onClick={() => setSelectedSkillId("")} sx={{ alignSelf: "flex-start" }}>Back to Adventure Skills</Button>
      <Box>
        <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{selectedSkill.skillName}</Typography>
        <Typography variant="body2" color="text.secondary">{selectedSkill.completedRequirements}/{selectedSkill.totalRequirements} competency points complete · {selectedSkill.awardedStages}/{selectedSkill.stageCount} stages awarded</Typography>
      </Box>

      {selectedSkill.stages.map((stage) => <Accordion key={stage.stage} disableGutters elevation={0} sx={{ border: 1, borderColor: "divider", "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<Typography component="span" aria-hidden="true" sx={{ fontSize: 20, lineHeight: 1 }}>⌄</Typography>} aria-controls={`${selectedSkill.skillId}-stage-${stage.stage}-content`} id={`${selectedSkill.skillId}-stage-${stage.stage}-header`}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ width: "100%", pr: 1, alignItems: { sm: "center" }, justifyContent: "space-between" }}>
            <Typography sx={{ fontWeight: 700 }}>Stage {stage.stage}</Typography>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Chip size="small" variant="outlined" color={stage.status === "requirements-complete" || stage.status === "awarded" ? "success" : "default"} label={`${stage.completedRequirements}/${stage.totalRequirements} points`} />
              <Chip size="small" color={stage.status === "requirements-complete" ? "warning" : stage.status === "awarded" ? "success" : stage.status === "in-progress" ? "info" : "default"} variant={stage.status === "not-started" ? "outlined" : "filled"} label={stageStatus(stage.status)} />
            </Stack>
          </Stack>
        </AccordionSummary>
        <AccordionDetails id={`${selectedSkill.skillId}-stage-${stage.stage}-content`}>
          <Stack spacing={1}>
            {stage.requirements.map((requirement) => <Paper key={requirement.requirementId} variant="outlined" sx={{ p: 1.25 }} data-testid={`parent-adventure-requirement-${requirement.requirementId}`}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                <Chip size="small" color={requirement.completed ? "success" : "default"} variant={requirement.completed ? "filled" : "outlined"} label={requirement.completed ? "Completed" : "Outstanding"} sx={{ mt: 0.1, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ pt: 0.25 }}>{requirement.statement}</Typography>
              </Stack>
            </Paper>)}
          </Stack>
        </AccordionDetails>
      </Accordion>)}
    </Stack>}
  </Stack>;
}
