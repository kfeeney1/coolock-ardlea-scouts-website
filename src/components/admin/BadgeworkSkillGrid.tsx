import { Box, Button, Typography } from "@mui/material";

import AdventureSkillBadgeIcon from "./AdventureSkillBadgeIcon.tsx";
import type { AdventureSkillOverview } from "../../services/adventureSkillOverviewLogic.ts";
import { highestAwardedLevelLabel } from "../../services/adventureSkillPresentation.ts";

type Props = {
  memberName: string;
  onOpenStage: (skillId: string, stage: number) => void;
  summaries: readonly AdventureSkillOverview[];
};

export default function BadgeworkSkillGrid({ memberName, onOpenStage, summaries }: Props) {
  return <Box
    data-testid="badgework-skill-grid"
    sx={{
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: { xs: .75, sm: 1 },
      alignItems: "stretch"
    }}
  >
    {summaries.map((summary, index) => {
      const levelLabel = highestAwardedLevelLabel(summary.highestAwardedStage);
      const isSwimming = summary.skillId === "swimming";
      return <Button
        key={summary.skillId}
        variant="outlined"
        onClick={() => onOpenStage(summary.skillId, summary.nextStage)}
        aria-label={`${memberName} · ${summary.skillName} · ${levelLabel}`}
        data-testid={`badgework-skill-tile-${summary.skillId}`}
        sx={{
          minWidth: 0,
          minHeight: { xs: 126, sm: 142 },
          p: { xs: .75, sm: 1.15 },
          borderRadius: 2,
          textTransform: "none",
          color: "text.primary",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: .65,
          gridColumn: isSwimming ? "2" : undefined,
          gridRow: isSwimming ? "4" : undefined,
          "&:hover": { borderColor: "secondary.main", backgroundColor: "action.hover" }
        }}
      >
        <AdventureSkillBadgeIcon skillId={summary.skillId} size={index < 9 ? 52 : 52} />
        <Typography
          component="span"
          sx={{
            fontWeight: 800,
            fontSize: { xs: ".76rem", sm: ".88rem" },
            lineHeight: 1.12,
            textAlign: "center",
            overflowWrap: "anywhere"
          }}
        >
          {summary.skillName}
        </Typography>
        <Typography component="span" variant="caption" color="text.secondary" sx={{ lineHeight: 1.1, textAlign: "center" }}>
          {levelLabel}
        </Typography>
      </Button>;
    })}
  </Box>;
}
