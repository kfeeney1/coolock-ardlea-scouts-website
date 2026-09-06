import { Box, Checkbox, Paper, Stack, Typography } from "@mui/material";

import type { AdventureSkillStage } from "../../data/adventureSkills/index.ts";
import type { MemberRecord } from "../../services/memberAdmin.ts";
import type { MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import { memberRequirementCompletion } from "../../services/adventureSkillMemberDraftLogic.ts";

type Props = {
  disabled: boolean;
  groupDraft: ReadonlyMap<string, boolean>;
  memberDraft: ReadonlyMap<string, boolean>;
  members: readonly MemberRecord[];
  onChange: (memberId: string, requirementId: string, completed: boolean) => void;
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>;
  stage: AdventureSkillStage;
};

export default function BadgeworkCompetencyChildMatrix({ disabled, groupDraft, memberDraft, members, onChange, progressByMemberId, stage }: Props) {
  if (members.length < 2) return null;
  return <Paper variant="outlined" sx={{ p: 2, mb: 2 }} data-testid="badgework-competency-child-matrix">
    <Typography sx={{ fontWeight: 800, mb: .5 }}>Child-by-child competency matrix</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Use this for exceptions in a mixed group. The main competency controls below still update everyone selected.</Typography>
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: `minmax(170px, 1fr) repeat(${stage.requirements.length}, minmax(58px, 72px))`, minWidth: 170 + stage.requirements.length * 58 }}>
        <Box sx={{ p: 1, fontWeight: 800 }}>Child</Box>
        {stage.requirements.map((requirement, index) => <Box key={requirement.id} title={requirement.statement} sx={{ p: 1, textAlign: "center", fontWeight: 800 }}>{index + 1}</Box>)}
        {members.flatMap((member) => [
          <Box key={`${member.id}-name`} sx={{ p: 1, borderTop: 1, borderColor: "divider" }}><Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography><Typography variant="caption" color="text.secondary">{member.section}</Typography></Box>,
          ...stage.requirements.map((requirement) => {
            const checked = memberRequirementCompletion(member.id, requirement.id, progressByMemberId, groupDraft, memberDraft);
            return <Box key={`${member.id}-${requirement.id}`} sx={{ display: "grid", placeItems: "center", borderTop: 1, borderColor: "divider" }}><Checkbox disabled={disabled} checked={checked} onChange={(_, value) => onChange(member.id, requirement.id, value)} inputProps={{ "aria-label": `${member.displayName} · competency ${stage.requirements.indexOf(requirement) + 1}` }} /></Box>;
          })
        ])}
      </Box>
    </Box>
    <Stack spacing={.35} sx={{ mt: 1.5 }}>
      {stage.requirements.map((requirement, index) => <Typography key={requirement.id} variant="caption" color="text.secondary"><strong>{index + 1}.</strong> {requirement.statement}</Typography>)}
    </Stack>
  </Paper>;
}
