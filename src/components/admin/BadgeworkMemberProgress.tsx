import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";

import type { MemberRecord } from "../../services/memberAdmin.ts";
import type { AdventureStageAwardRecord, MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import { adventureSkillOverview, type AdventureStageOverviewStatus } from "../../services/adventureSkillOverviewLogic.ts";

type Props = {
  member: MemberRecord;
  onBack: () => void;
  onOpenStage: (memberId: string, skillId: string, stage: number) => void;
  progress: MemberAdventureProgress;
};

const stageLabel = (status: AdventureStageOverviewStatus) => status === "requirements-complete" ? "Awaiting award" : status === "in-progress" ? "In progress" : status === "awarded" ? "Awarded" : "Not started";
const stageColor = (status: AdventureStageOverviewStatus): "warning" | "info" | "success" | "inherit" => status === "requirements-complete" ? "warning" : status === "in-progress" ? "info" : status === "awarded" ? "success" : "inherit";
const awardKey = (award: AdventureStageAwardRecord) => `${award.skillId}-${award.stage}`;
const formatAwardDate = (value: Date | null) => value ? `${String(value.getDate()).padStart(2, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${value.getFullYear()}` : "Date pending";

export default function BadgeworkMemberProgress({ member, onBack, onOpenStage, progress }: Props) {
  const summaries = adventureSkillOverview(progress);
  const awardedStages = summaries.reduce((total, skill) => total + skill.stages.filter((stage) => stage.status === "awarded").length, 0);
  const totalStages = summaries.reduce((total, skill) => total + skill.stages.length, 0);
  const awaitingAwards = summaries.reduce((total, skill) => total + skill.stages.filter((stage) => stage.status === "requirements-complete").length, 0);
  const awardsByStage = new Map(progress.awards.map((award) => [awardKey(award), award]));

  return <Stack spacing={2} data-testid={`badgework-member-progress-${member.id}`}>
    <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Box>
          <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>{member.displayName}</Typography>
          <Typography color="text.secondary">{member.section} · Complete Adventure Skills journey</Typography>
        </Box>
        <Button variant="outlined" onClick={onBack}>Back to group overview</Button>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 2 }}>
        <Chip color="success" label={`${awardedStages}/${totalStages} stages awarded`} />
        {awaitingAwards > 0 && <Chip color="warning" label={`${awaitingAwards} awaiting award`} />}
      </Stack>
    </Paper>

    {awaitingAwards > 0 && <Alert severity="warning">This child has {awaitingAwards} completed {awaitingAwards === 1 ? "stage" : "stages"} awaiting a formal badge award.</Alert>}

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2,minmax(0,1fr))" }, gap: 2 }}>
      {summaries.map((skill) => {
        const completedPoints = skill.stages.reduce((total, stage) => total + stage.completedRequirements, 0);
        const totalPoints = skill.stages.reduce((total, stage) => total + stage.totalRequirements, 0);
        const percentage = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;
        const skillAwards = skill.stages.flatMap((stage) => {
          const award = awardsByStage.get(`${skill.skillId}-${stage.stage}`);
          return award ? [{ stage: stage.stage, award }] : [];
        });
        return <Paper key={skill.skillId} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }} data-testid={`badgework-member-skill-${skill.skillId}`}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{skill.skillName}</Typography>
            <Chip size="small" label={`${completedPoints}/${totalPoints} points`} />
          </Stack>
          <LinearProgress variant="determinate" value={percentage} color={skill.status === "requirements-complete" ? "warning" : skill.highestAwardedStage > 0 ? "success" : "info"} sx={{ height: 8, borderRadius: 4, my: 1.5 }} aria-label={`${skill.skillName} ${percentage}% complete`} />
          <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            {skill.stages.map((stage) => <Button key={stage.stage} size="small" variant={stage.status === "not-started" ? "outlined" : "contained"} color={stageColor(stage.status)} onClick={() => onOpenStage(member.id, skill.skillId, stage.stage)} aria-label={`${member.displayName} · ${skill.skillName} · Stage ${stage.stage} · ${stageLabel(stage.status)}`} sx={{ minWidth: 42, px: 1 }}>
              {stage.stage}
            </Button>)}
          </Stack>
          {skillAwards.length > 0 && <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: .5 }}>Award history</Typography>
            <Stack spacing={.5}>
              {skillAwards.map(({ stage, award }) => <Typography key={award.id} variant="body2" color="text.secondary" data-testid={`badgework-award-history-${skill.skillId}-${stage}`}>
                Stage {stage} · {formatAwardDate(award.awardedAt)} · awarded by {award.awardedBy}
              </Typography>)}
            </Stack>
          </Box>}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {skill.highestAwardedStage > 0 ? `Highest awarded: Stage ${skill.highestAwardedStage}. ` : ""}Select a stage to review or record its competency points.
          </Typography>
        </Paper>;
      })}
    </Box>
  </Stack>;
}
