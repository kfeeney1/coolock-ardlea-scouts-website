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
  return <Box data-testid="badgework-progress-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(auto-fit, minmax(min(100%, 112px), 1fr))", sm: "repeat(auto-fit, minmax(144px, 1fr))" }, gap: 1, alignItems: "stretch" }}>
    {summaries.flatMap(summary => {
      const stages = allStages ? summary.stages : summary.stages.filter(stage => stage.stage === (stageNumber ?? summary.nextStage));
      return stages.map(stage => <Paper key={`${summary.skillId}-${stage.stage}`} variant="outlined" data-testid={`badgework-progress-card-${summary.skillId}-${stage.stage}`} sx={{ p: 1, borderRadius: 2, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <AdventureSkillBadge skillId={summary.skillId} progress={stage} size={144} />
        {!allStages && summary.highestAwardedStage > 0 && summary.highestAwardedStage !== stage.stage && <Typography variant="caption" sx={{ mt: .75, width: "100%" }}>Highest awarded: Stage {summary.highestAwardedStage}</Typography>}
        <Stack sx={{ width: "100%", pt: 1, mt: "auto" }}>
          <Button variant="outlined" onClick={() => onOpenStage(summary.skillId, stage.stage)} aria-label={`${memberName} · ${summary.skillName} · Stage ${stage.stage} · Open stage`} sx={{ minHeight: 44, minWidth: 0, px: .5 }}>Open stage {stage.stage}</Button>
        </Stack>
      </Paper>);
    })}
  </Box>;
}
