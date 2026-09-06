import { Box, Checkbox, Paper, Stack, Typography } from "@mui/material";

import type { AdventureSkillStage } from "../../data/adventureSkills/index.ts";
import type { MemberRecord } from "../../services/memberAdmin.ts";
import type { MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import {
  memberRequirementCompletion,
  memberRequirementDraftCompletion,
  memberRequirementDraftKey
} from "../../services/adventureSkillMemberDraftLogic.ts";

type Props = {
  disabled?: boolean;
  groupDraft: ReadonlyMap<string, boolean>;
  memberDraft: ReadonlyMap<string, boolean>;
  members: readonly MemberRecord[];
  onMemberRequirementChange: (memberId: string, requirementId: string, completed: boolean) => void;
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>;
  stage: AdventureSkillStage;
};

export default function BadgeworkCompetencyChildMatrix({
  disabled = false,
  groupDraft,
  memberDraft,
  members,
  onMemberRequirementChange,
  progressByMemberId,
  stage
}: Props) {
  if (members.length < 2 || stage.requirements.length === 0) return null;
  return <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5 }} data-testid="badgework-competency-child-matrix">
    <Typography sx={{ fontWeight: 800, mb: .35 }}>Edit individual children</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>Tick or untick a child’s competency point to create an individual draft change. The group controls below still apply to every selected child.</Typography>
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: `minmax(150px, 1fr) repeat(${stage.requirements.length}, minmax(48px, 58px))`, minWidth: 150 + stage.requirements.length * 48 }}>
        <Box sx={{ p: .75, fontWeight: 800 }}>Child</Box>
        {stage.requirements.map((requirement, index) => <Box key={requirement.id} title={requirement.statement} sx={{ p: .75, textAlign: "center", fontWeight: 800 }}>{index + 1}</Box>)}
        {members.flatMap((member) => [
          <Box key={`${member.id}-name`} sx={{ p: .75, borderTop: 1, borderColor: "divider" }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{member.displayName}</Typography></Box>,
          ...stage.requirements.map((requirement, index) => {
            const persisted = memberRequirementCompletion(progressByMemberId.get(member.id), requirement.id);
            const baseline = groupDraft.get(requirement.id) ?? persisted;
            const complete = memberRequirementDraftCompletion(memberDraft, member.id, requirement.id, baseline);
            const changed = memberDraft.has(memberRequirementDraftKey(member.id, requirement.id));
            return <Box key={`${member.id}-${requirement.id}`} sx={{ display: "grid", placeItems: "center", borderTop: 1, borderColor: "divider" }}>
              <Checkbox
                checked={complete}
                disabled={disabled}
                onChange={(_, checked) => onMemberRequirementChange(member.id, requirement.id, checked)}
                size="small"
                slotProps={{ input: { "aria-label": `${member.displayName} · competency ${index + 1} · ${complete ? "complete" : "not complete"}${changed ? " · unsaved change" : ""}` } }}
              />
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
