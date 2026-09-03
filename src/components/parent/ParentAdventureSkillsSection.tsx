import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
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

import {
  OperationalLoading,
  OperationalPermissionState,
  OperationalUnavailableState,
  OperationalErrorState
} from "../admin/OperationalStates";
import { loadLinkedMembers, type ParentLinkedMember } from "../../services/parentConsent";
import { loadMemberAdventureProgress, type MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import { parentAdventureSkillSummaries } from "../../services/parentAdventureSkillProgressLogic.ts";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../../services/firestoreErrors";

export default function ParentAdventureSkillsSection({ memberIds }: { memberIds: string[] }) {
  const [members, setMembers] = useState<ParentLinkedMember[]>([]);
  const [progressByMember, setProgressByMember] = useState(new Map<string, MemberAdventureProgress>());
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const linkedMembers = await loadLinkedMembers(memberIds);
      const progress = await Promise.all(linkedMembers.map((member) => loadMemberAdventureProgress(member.id)));
      setMembers(linkedMembers);
      setProgressByMember(new Map(progress.map((item) => [item.memberId, item])));
      setSelectedMemberId((current) => current && linkedMembers.some((member) => member.id === current) ? current : linkedMembers[0]?.id ?? "");
    } catch (error) {
      console.error("Unable to load parent Adventure Skills progress:", error);
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [memberIds]);

  useEffect(() => { void load(); }, [load]);

  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const progress = selectedMember ? progressByMember.get(selectedMember.id) : undefined;
  const summaries = useMemo(() => progress ? parentAdventureSkillSummaries(progress) : [], [progress]);

  if (loading) {
    return <OperationalLoading minHeight={180} label="Loading Adventure Skills progress" />;
  }

  if (loadError) {
    const message = firestoreFailureMessage(loadError, "Unable to load Adventure Skills progress right now. Please try again.");
    if (classifyFirestoreFailure(loadError) === "permission") {
      return (
        <OperationalPermissionState
          title="Adventure Skills access unavailable"
          actionLabel="Retry"
          onAction={() => void load()}
          testId="parent-adventure-skills-permission"
        >
          {message}
        </OperationalPermissionState>
      );
    }
    return (
      <OperationalErrorState
        title="Adventure Skills could not be loaded"
        actionLabel="Retry"
        onAction={() => void load()}
        testId="parent-adventure-skills-error"
      >
        {message}
      </OperationalErrorState>
    );
  }

  if (members.length === 0) {
    return (
      <OperationalUnavailableState title="Adventure Skills not available yet" testId="parent-adventure-skills-unavailable">
        No linked child record is available for Adventure Skills progress yet. Please ask a leader to review Parent Access.
      </OperationalUnavailableState>
    );
  }

  return <Stack spacing={2.5}>
    <Typography color="text.secondary">Adventure Skills progress is read-only here. Expand a stage to see each competency point and whether it has been completed.</Typography>

    {members.length > 1 && <FormControl fullWidth>
      <InputLabel>Child</InputLabel>
      <Select label="Child" value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)}>
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

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
      {summaries.map((skill) => <Paper key={skill.skillId} variant="outlined" sx={{ p: { xs: 1.5, sm: 2.25 } }} data-testid={`parent-adventure-skill-${skill.skillId}`}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{skill.skillName}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{skill.completedRequirements}/{skill.totalRequirements} competency points complete · {skill.awardedStages}/{skill.stageCount} stages awarded</Typography>
          </Box>

          <Stack spacing={1}>
            {skill.stages.map((stage) => <Accordion key={stage.stage} disableGutters elevation={0} sx={{ border: 1, borderColor: "divider", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<Typography component="span" aria-hidden="true" sx={{ fontSize: 20, lineHeight: 1 }}>⌄</Typography>} aria-controls={`${skill.skillId}-stage-${stage.stage}-content`} id={`${skill.skillId}-stage-${stage.stage}-header`}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ width: "100%", pr: 1, alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                  <Typography sx={{ fontWeight: 700 }}>Stage {stage.stage}</Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                    <Chip size="small" variant="outlined" color={stage.requirementsComplete ? "success" : "default"} label={`${stage.completedRequirements}/${stage.totalRequirements} points`} />
                    {stage.requirementsComplete && <Chip size="small" color="success" label="Requirements complete" />}
                    {stage.awarded && <Chip size="small" color="secondary" label="Awarded" />}
                  </Stack>
                </Stack>
              </AccordionSummary>
              <AccordionDetails id={`${skill.skillId}-stage-${stage.stage}-content`}>
                <Stack spacing={1}>
                  {stage.requirements.map((requirement) => <Paper key={requirement.requirementId} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                      <Chip
                        size="small"
                        color={requirement.completed ? "success" : "default"}
                        variant={requirement.completed ? "filled" : "outlined"}
                        label={requirement.completed ? "Completed" : "Outstanding"}
                        sx={{ mt: 0.1, flexShrink: 0 }}
                      />
                      <Typography variant="body2" sx={{ pt: 0.25 }}>{requirement.statement}</Typography>
                    </Stack>
                  </Paper>)}
                </Stack>
              </AccordionDetails>
            </Accordion>)}
          </Stack>
        </Stack>
      </Paper>)}
    </Box>
  </Stack>;
}
