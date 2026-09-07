import { Box, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";

import type { AdventureSkill } from "../../data/adventureSkills/index.ts";
import type { MemberRecord } from "../../services/memberAdmin.ts";
import type { MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import { adventureSkillOverview, type AdventureStageOverviewStatus } from "../../services/adventureSkillOverviewLogic.ts";
import { compareAdventureSkillMatrixProgress } from "../../services/adventureSkillMatrixSortLogic.ts";

type Props = {
  members: readonly MemberRecord[];
  onOpenStage: (memberId: string, skillId: string, stage: number) => void;
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>;
  skill: AdventureSkill;
};

const statusPresentation: Record<AdventureStageOverviewStatus, { color: "default" | "info" | "warning" | "success"; label: string; shortLabel: string }> = {
  "not-started": { color: "default", label: "Not started", shortLabel: "Not started" },
  "in-progress": { color: "info", label: "Started", shortLabel: "Started" },
  "requirements-complete": { color: "warning", label: "Awaiting award", shortLabel: "Awaiting" },
  awarded: { color: "success", label: "Awarded", shortLabel: "Awarded" }
};

export default function BadgeworkLevelMatrix({ members, onOpenStage, progressByMemberId, skill }: Props) {
  const rows = members.map((member) => {
    const progress = progressByMemberId.get(member.id) ?? { memberId: member.id, requirements: [], awards: [] };
    const summary = adventureSkillOverview(progress).find((item) => item.skillId === skill.id)!;
    return { member, summary };
  }).sort((left, right) => compareAdventureSkillMatrixProgress(left.summary, right.summary) || left.member.displayName.localeCompare(right.member.displayName));

  return <Paper variant="outlined" sx={{ overflow: "hidden" }} data-testid="badgework-level-matrix">
    <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>{skill.name} level matrix</Typography>
      <Typography variant="body2" color="text.secondary">Children are sorted by progress, with those furthest through this skill first. Select a cell to review or record its competencies.</Typography>
    </Box>
    <TableContainer>
      <Table size="small" aria-label={`${skill.name} level progress by child`} sx={{ minWidth: 210 + skill.stages.length * 112 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 210, position: "sticky", left: 0, zIndex: 2, backgroundColor: "background.paper", fontWeight: 800 }}>Child</TableCell>
            {skill.stages.map((stage) => <TableCell key={stage.stage} align="center" sx={{ minWidth: 112, fontWeight: 800 }}>Level {stage.stage}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ member, summary }) => <TableRow key={member.id} hover>
            <TableCell component="th" scope="row" sx={{ position: "sticky", left: 0, zIndex: 1, backgroundColor: "background.paper" }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>{member.displayName}</Typography>
              <Typography variant="caption" color="text.secondary">{member.section}</Typography>
            </TableCell>
            {summary.stages.map((stage) => {
              const presentation = statusPresentation[stage.status];
              return <TableCell key={stage.stage} align="center" sx={{ p: .75 }}>
                <Button
                  fullWidth
                  size="small"
                  variant="text"
                  onClick={() => onOpenStage(member.id, skill.id, stage.stage)}
                  aria-label={`${member.displayName} · ${skill.name} · Level ${stage.stage} · ${presentation.label} · ${stage.completedRequirements} of ${stage.totalRequirements} competencies complete`}
                  sx={{ minWidth: 96, p: .5, textTransform: "none" }}
                >
                  <Box component="span" sx={{ display: "grid", gap: .35, justifyItems: "center" }}>
                    <Chip component="span" size="small" color={presentation.color} label={presentation.shortLabel} />
                    <Typography component="span" variant="caption" color="text.secondary">{stage.completedRequirements}/{stage.totalRequirements}</Typography>
                  </Box>
                </Button>
              </TableCell>;
            })}
          </TableRow>)}
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>;
}
