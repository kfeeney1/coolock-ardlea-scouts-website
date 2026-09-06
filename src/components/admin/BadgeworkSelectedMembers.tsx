import { Chip, Paper, Stack, Typography } from "@mui/material";

import type { MemberRecord } from "../../services/memberAdmin.ts";

type Props = { members: readonly MemberRecord[] };

export default function BadgeworkSelectedMembers({ members }: Props) {
  return <Paper variant="outlined" sx={{ p: 1.5, mb: 3 }} data-testid="badgework-selected-members">
    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
      <Typography sx={{ fontWeight: 800 }}>{members.length} selected:</Typography>
      {members.map((member) => <Chip key={member.id} size="small" label={`${member.displayName} · ${member.section}`} />)}
    </Stack>
  </Paper>;
}
