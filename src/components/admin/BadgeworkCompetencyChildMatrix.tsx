import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { Box, Paper, Stack, Typography } from "@mui/material";

import type { AdventureSkillStage } from "../../data/adventureSkills/index.ts";
import type { MemberRecord } from "../../services/memberAdmin.ts";
import type { MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import { memberRequirementCompletion } from "../../services/adventureSkillMemberDraftLogic.ts";

type Props = {
  members: readonly MemberRecord[];
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>;
  stage: AdventureSkillStage;
};

export default function BadgeworkCompetencyChildMatrix({ members, progressByMemberId, stage }: Props) {
  if (members.length < 2 || stage.requirements.length === 0) return null;
  return <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5 }} data-testid="badgework-competency-child-matrix">
    <Typography sx={{ fontWeight: 800, mb: .35 }}>Competency matrix</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>See exactly which saved competency points each selected child has completed before applying group changes below.</Typography>
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: `minmax(150px, 1fr) repeat(${stage.requirements.length}, minmax(48px, 58px))`, minWidth: 150 + stage.requirements.length * 48 }}>
        <Box sx={{ p: .75, fontWeight: 800 }}>Child</Box>
        {stage.requirements.map((requirement, index) => <Box key={requirement.id} title={requirement.statement} sx={{ p: .75, textAlign: "center", fontWeight: 800 }}>{index + 1}</Box>)}
        {members.flatMap((member) => [
          <Box key={`${member.id}-name`} sx={{ p: .75, borderTop: 1, borderColor: "divider" }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{member.displayName}</Typography></Box>,
          ...stage.requirements.map((requirement, index) => {
            const complete = memberRequirementCompletion(progressByMemberId.get(member.id), requirement.id);
            return <Box key={`${member.id}-${requirement.id}`} sx={{ display: "grid", placeItems: "center", borderTop: 1, borderColor: "divider" }} aria-label={`${member.displayName} · competency ${index + 1} · ${complete ? "complete" : "not complete"}`}>
              {complete ? <CheckCircleIcon color="success" fontSize="small" /> : <RadioButtonUncheckedIcon color="disabled" fontSize="small" />}
            </Box>;
          })
        ])}
      </Box>
    </Box>
    <Stack spacing={.25} sx={{ mt: 1.25 }}>
      {stage.requirements.map((requirement, index) => <Typography key={requirement.id} variant="caption" color="text.secondary"><strong>{index + 1}.</strong> {requirement.statement}</Typography>)}
    </Stack>
  </Paper>;
}
