import { Box, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";

import AdventureSkillBadge from "../badgework/AdventureSkillBadge.tsx";
import { adventureSkillDraftPreview } from "../../services/adventureSkillDraftPreview.ts";

import BadgeworkCompetencyChildMatrix from "./BadgeworkCompetencyChildMatrix.tsx";
import type { AdventureSkill, AdventureSkillStage } from "../../data/adventureSkills/index.ts";
import type { MemberRecord } from "../../services/memberAdmin.ts";
import type { MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import { memberStageSummary, memberStageSummaryLabel } from "../../services/adventureSkillMemberStageSummaryLogic.ts";

type Props = {
  redesigned?: boolean;
  disabled?: boolean;
  groupDraft: ReadonlyMap<string, boolean>;
  memberDraft: ReadonlyMap<string, boolean>;
  members: readonly MemberRecord[];
  onMemberRequirementChange: (memberId: string, requirementId: string, completed: boolean) => void;
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>;
  skill: AdventureSkill;
  stage: AdventureSkillStage;
};

const statusColor = {
  "not-started": "default",
  "in-progress": "info",
  "requirements-complete": "warning",
  awarded: "success"
} as const;

export default function BadgeworkSelectedMemberStageSummary({
  redesigned = false,
  disabled = false,
  groupDraft,
  memberDraft,
  members,
  onMemberRequirementChange,
  progressByMemberId,
  skill,
  stage
}: Props) {
  return <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }} data-testid="badgework-selected-member-stage-summary">
    <Box sx={{ mb: 1.25 }}>
      <Typography sx={{ fontWeight: 800 }}>Selected children · Stage {stage.stage}</Typography>
      <Typography variant="body2" color="text.secondary">{redesigned ? "Review each child’s preview, then save or discard your changes." : "Review saved progress, then edit individual children or use the group controls below."}</Typography>
    </Box>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" }, gap: 1 }}>
      {members.map((member) => {
        const saved = progressByMemberId.get(member.id);
        const preview = redesigned ? adventureSkillDraftPreview(member.id, saved, groupDraft, memberDraft) : saved;
        const unsaved = redesigned && (groupDraft.size > 0 || [...memberDraft.keys()].some(key => key.startsWith(`${member.id}::`)));
        const summary = memberStageSummary(member.id, preview, skill, stage);
        const percent = summary.totalRequirements > 0 ? Math.round((summary.completedRequirements / summary.totalRequirements) * 100) : 0;
        return <Paper key={member.id} variant="outlined" sx={{ p: 1.25 }} data-testid={`badgework-stage-member-${member.id}`}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.displayName}</Typography>
              <Typography variant="caption" color="text.secondary">{member.section}</Typography>
            </Box>
            {!redesigned && <Chip size="small" color={statusColor[summary.status]} label={memberStageSummaryLabel(summary)} />}
          </Stack>
          {redesigned ? <Box sx={{ mt: 1 }}><AdventureSkillBadge skillId={skill.id} progress={{ ...summary, stage: stage.stage }} unsaved={unsaved} size={144} /></Box> : <LinearProgress value={percent} variant="determinate" color={summary.status === "requirements-complete" ? "warning" : summary.status === "awarded" ? "success" : "info"} sx={{ mt: 1, height: 6, borderRadius: 3 }} aria-label={`${member.displayName} Stage ${stage.stage} ${summary.completedRequirements} of ${summary.totalRequirements} points complete`} />}
        </Paper>;
      })}
    </Box>
    <BadgeworkCompetencyChildMatrix
      disabled={disabled}
      groupDraft={groupDraft}
      memberDraft={memberDraft}
      members={members}
      onMemberRequirementChange={onMemberRequirementChange}
      progressByMemberId={progressByMemberId}
      stage={stage}
    />
  </Paper>;
}
