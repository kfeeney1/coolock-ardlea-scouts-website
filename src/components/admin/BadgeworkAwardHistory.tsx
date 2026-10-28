import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import AdventureSkillBadge from "../badgework/AdventureSkillBadge.tsx";
import { adventureSkillOverview } from "../../services/adventureSkillOverviewLogic.ts";
import { matchesBadgeworkLevelNumber, type BadgeworkLevelFilter } from "../../services/adventureSkillOverviewFilterLogic.ts";
import type { MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import type { MemberRecord } from "../../services/memberAdmin.ts";
import { formatSiteDate } from "../../services/siteDateFormat";

type Props = { members: readonly MemberRecord[]; progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>; skillFilter: string; levelFilter: BadgeworkLevelFilter; exactLevelFilter: string; onOpenMember: (id: string) => void };

export default function BadgeworkAwardHistory({ members, progressByMemberId, skillFilter, levelFilter, exactLevelFilter, onOpenMember }: Props) {
  const entries = members.flatMap(member => {
    const progress = progressByMemberId.get(member.id);
    if (!progress) return [];
    return adventureSkillOverview(progress).filter(skill => skillFilter === "all" || skill.skillId === skillFilter).flatMap(skill => skill.stages
      .filter(stage => stage.status === "awarded" && matchesBadgeworkLevelNumber(stage.stage, levelFilter) && (exactLevelFilter === "all" || stage.stage === Number(exactLevelFilter)))
      .map(stage => ({ member, skillId: skill.skillId, stage, award: progress.awards.find(award => award.skillId === skill.skillId && award.stage === stage.stage)! })));
  });
  if (!entries.length) return <Alert severity="info">No saved awards match these filters.</Alert>;
  return <Box data-testid="badgework-award-history" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" }, gap: 1.5 }}>
    {entries.map(({member,skillId,stage,award}) => <Paper key={`${member.id}-${skillId}-${stage.stage}`} variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Stack spacing={1}>
        <Typography sx={{ fontWeight: 800 }}>{member.displayName}</Typography><Typography variant="caption">{member.section}</Typography>
        <AdventureSkillBadge skillId={skillId} progress={stage} />
        <Typography variant="caption">Awarded {award.awardedAt ? formatSiteDate(award.awardedAt) : "date not recorded"} · {award.awardedBy}</Typography>
        <Button variant="outlined" onClick={() => onOpenMember(member.id)} sx={{ minHeight: 44 }}>View history and provenance</Button>
      </Stack>
    </Paper>)}
  </Box>;
}
