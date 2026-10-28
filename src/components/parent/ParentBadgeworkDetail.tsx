import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import BadgeworkProgressGrid from "../badgework/BadgeworkProgressGrid.tsx";
import type { ParentAdventureSkillSummary } from "../../services/parentAdventureSkillProgressLogic.ts";

type Props = { memberName: string; skill: ParentAdventureSkillSummary; initialStage: number; onBack: () => void };

/** Read-only stage navigation; all artwork/counts come from the shared saved summary. */
export default function ParentBadgeworkDetail({ memberName, skill, initialStage, onBack }: Props) {
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const [stageNumber, setStageNumber] = useState(initialStage);
  const [allStages, setAllStages] = useState(false);
  const stage = skill.stages.find(item => item.stage === stageNumber) ?? skill.stages[0];
  useEffect(() => { detailHeading.current?.focus(); }, [stageNumber]);
  return <Stack spacing={1.5} data-testid={`parent-adventure-skill-${skill.skillId}`}>
    <Button variant="outlined" onClick={onBack} sx={{ alignSelf: "flex-start", minHeight: 44 }}>Back to Adventure Skills</Button>
    <Box><Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{skill.skillName}</Typography>
      <Typography variant="body2" color="text.secondary">{skill.completedRequirements}/{skill.totalRequirements} competency points complete · {skill.awardedStages}/{skill.stageCount} stages awarded</Typography>
      {skill.highestAwardedStage > 0 && <Typography variant="body2">Highest awarded: Stage {skill.highestAwardedStage}</Typography>}
    </Box>
    <Button variant="outlined" aria-expanded={allStages} onClick={() => { if (allStages) setStageNumber(skill.nextStage); setAllStages(value => !value); }} sx={{ alignSelf: "flex-start", minHeight: 44 }} aria-label={`${skill.skillName} · ${allStages ? "Show current stage" : "Show all stages"}`}>{allStages ? "Show current stage" : "Show all stages"}</Button>
    <BadgeworkProgressGrid memberName={memberName} summaries={[skill]} stageNumber={stage.stage} allStages={allStages} onOpenStage={(_, number) => setStageNumber(number)} />
    <Paper variant="outlined" sx={{ p: 1.5 }} aria-labelledby="parent-stage-competencies" data-testid="parent-stage-competencies">
      <Typography ref={detailHeading} tabIndex={-1} id="parent-stage-competencies" variant="h6" sx={{ mb: 1.5, fontWeight: 800 }}>Stage {stage.stage} competencies</Typography>
      <Stack spacing={1}>{stage.requirements.map(requirement => <Paper key={requirement.requirementId} variant="outlined" sx={{ p: 1.25 }} data-testid={`parent-adventure-requirement-${requirement.requirementId}`}>
        <Stack spacing={.75}><Chip size="small" color={requirement.completed ? "success" : "default"} variant="outlined" label={requirement.completed ? "Completed" : "Outstanding"} sx={{ alignSelf: "flex-start", color: "text.primary" }} /><Typography variant="body2">{requirement.statement}</Typography></Stack>
      </Paper>)}</Stack>
    </Paper>
  </Stack>;
}
