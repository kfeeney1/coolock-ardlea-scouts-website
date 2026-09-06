import { Box, Button, Typography } from "@mui/material";

import type { AdventureSkill } from "../../data/adventureSkills/index.ts";
import type { MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import {
  badgeworkStageNavigation,
  badgeworkStageNavigationLabel
} from "../../services/adventureSkillStageNavigationLogic.ts";

type BadgeworkStageNavigationProps = {
  currentStage: number;
  disabled?: boolean;
  onChange: (stage: number) => void;
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>;
  selectedMemberIds: readonly string[];
  skill: AdventureSkill;
};

const statusColour = {
  "not-started": "inherit",
  "in-progress": "primary",
  "requirements-complete": "warning",
  awarded: "success"
} as const;

export default function BadgeworkStageNavigation({
  currentStage,
  disabled = false,
  onChange,
  progressByMemberId,
  selectedMemberIds,
  skill
}: BadgeworkStageNavigationProps) {
  const summaries = badgeworkStageNavigation(skill, selectedMemberIds, progressByMemberId);

  return <Box component="nav" aria-label={`${skill.name} stages`} data-testid="badgework-stage-navigation">
    <Typography variant="subtitle2" sx={{ mb: .75, fontWeight: 800 }}>Stages</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", sm: "repeat(auto-fit, minmax(82px, 1fr))" }, gap: .75 }}>
      {summaries.map((summary) => {
        const label = badgeworkStageNavigationLabel(summary);
        const current = summary.stage === currentStage;
        return <Button
          key={summary.stage}
          aria-current={current ? "step" : undefined}
          aria-label={`Stage ${summary.stage} · ${label}`}
          color={statusColour[summary.status]}
          disabled={disabled}
          onClick={() => onChange(summary.stage)}
          size="small"
          variant={current ? "contained" : "outlined"}
          sx={{ minWidth: 0, minHeight: 54, px: .75, py: .5, display: "flex", flexDirection: "column", lineHeight: 1.15 }}
        >
          <Box component="span" sx={{ fontWeight: 800 }}>Stage {summary.stage}</Box>
          <Box component="span" sx={{ mt: .35, fontSize: ".66rem", fontWeight: 700, textTransform: "none" }}>{label}</Box>
        </Button>;
      })}
    </Box>
  </Box>;
}
