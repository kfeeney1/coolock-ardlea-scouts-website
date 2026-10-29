import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import AdventureSkillBadge from "./AdventureSkillBadge.tsx";
import type { AdventureSkillOverview } from "../../services/adventureSkillOverviewLogic.ts";

type Props = {
  memberName: string;
  summaries: readonly AdventureSkillOverview[];
  stageNumber?: number;
  allStages?: boolean;
  onOpenStage: (skillId: string, stage: number) => void;
};

/** Canonical stage cards shared by overview and member detail, without embedded edit capabilities. */
export default function BadgeworkProgressGrid({ memberName, summaries, stageNumber, allStages = false, onOpenStage }: Props) {
  return <Box data-testid="badgework-progress-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", sm: "repeat(auto-fit, minmax(144px, 1fr))" }, gap: { xs: .75, sm: 1 }, alignItems: "stretch", "& figcaption .MuiTypography-body2": { fontSize: { xs: ".6875rem", sm: ".875rem" }, overflowWrap: "anywhere", hyphens: "auto" }, "& figcaption .MuiTypography-caption": { fontSize: { xs: ".6875rem", sm: ".75rem" } }, "& figure .MuiButton-root": { minWidth: 0, px: .25, fontSize: { xs: ".6875rem", sm: ".875rem" } }, "& .MuiChip-root": { height: "auto", minHeight: 24 }, "& .MuiChip-label": { whiteSpace: "normal", overflow: "visible", textOverflow: "clip", py: .25, px: .5, fontSize: { xs: ".6875rem", sm: ".8125rem" } } }}>
    {summaries.flatMap(summary => {
      const stages = allStages ? summary.stages : summary.stages.filter(stage => stage.stage === (stageNumber ?? summary.nextStage));
      return stages.map(stage => <Paper key={`${summary.skillId}-${stage.stage}`} variant="outlined" data-testid={`badgework-progress-card-${summary.skillId}-${stage.stage}`} sx={{ p: { xs: .5, sm: 1 }, borderRadius: 2, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <AdventureSkillBadge skillId={summary.skillId} progress={stage} size={144} compact />
        {!allStages && summary.highestAwardedStage > 0 && summary.highestAwardedStage !== stage.stage && <Typography variant="caption" sx={{ mt: .75, width: "100%" }} aria-label={`Highest awarded: Stage ${summary.highestAwardedStage}`}><Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Highest awarded: Stage </Box><Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>Awarded </Box>{summary.highestAwardedStage}</Typography>}
        <Stack sx={{ width: "100%", pt: 1, mt: "auto" }}>
          <Button variant="outlined" onClick={() => onOpenStage(summary.skillId, stage.stage)} aria-label={`${memberName} · ${summary.skillName} · Stage ${stage.stage} · Open stage`} sx={{ minHeight: 44, minWidth: 0, px: .5, fontSize: { xs: ".6875rem", sm: ".875rem" }, lineHeight: 1.3 }}><Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Open stage {stage.stage}</Box><Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>Open</Box></Button>
        </Stack>
      </Paper>);
    })}
  </Box>;
}
