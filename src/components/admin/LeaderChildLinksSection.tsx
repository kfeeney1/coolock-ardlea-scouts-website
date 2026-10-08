import { useEffect, useState } from "react";
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import { loadLeaderChildRelationships, setLeaderChildRelationship } from "../../services/leaderChildRelationships";
import type { MemberRecord } from "../../services/memberAdmin";
import { loadSubsMembers, reconcileCurrentLeaderFamilySubs } from "../../services/subsLedger";

type Props = {
  leaderUid: string;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
};

export default function LeaderChildLinksSection({ leaderUid, onError, onMessage }: Props) {
  const [familyMembers, setFamilyMembers] = useState<MemberRecord[]>([]);
  const [linkedChildIds, setLinkedChildIds] = useState<string[]>([]);
  const [childToLink, setChildToLink] = useState("");
  const [familyWorking, setFamilyWorking] = useState(false);

  useEffect(() => {
    void Promise.all([loadSubsMembers(), loadLeaderChildRelationships(leaderUid)]).then(([members, relationships]) => {
      setFamilyMembers(members);
      setLinkedChildIds(relationships.filter((relationship) => relationship.active).map((relationship) => relationship.memberId));
    }).catch((e) => {
      onError(applicationErrorMessage(e, "Unable to load linked children for this leader.", "LeaderAccessManagement"));
    });
  }, [leaderUid, onError]);

  const linkChild = () => {
    if (!childToLink || familyWorking) return;
    const memberId = childToLink;
    setFamilyWorking(true);
    void setLeaderChildRelationship(leaderUid, memberId, true).then(async () => {
      setLinkedChildIds((ids) => [...new Set([...ids, memberId])]);
      setChildToLink("");
      await reconcileCurrentLeaderFamilySubs(memberId);
      onMessage("Leader-child relationship linked. Current Scout-year family Subs classification has been reconciled.");
    }).catch((e) => {
      onError(applicationErrorMessage(e, "Unable to link child.", "LeaderAccessManagement"));
    }).finally(() => setFamilyWorking(false));
  };

  const unlinkChild = (memberId: string) => {
    if (familyWorking) return;
    setFamilyWorking(true);
    void setLeaderChildRelationship(leaderUid, memberId, false).then(async () => {
      setLinkedChildIds((ids) => ids.filter((id) => id !== memberId));
      await reconcileCurrentLeaderFamilySubs(memberId);
      onMessage("Leader-child relationship unlinked. Current Scout-year family Subs classification has been reconciled.");
    }).catch((e) => {
      onError(applicationErrorMessage(e, "Unable to unlink child.", "LeaderAccessManagement"));
    }).finally(() => setFamilyWorking(false));
  };

  return <Box sx={{ mt: 3 }} data-testid="leader-child-links">
    <Typography variant="h6" color="secondary" sx={{ mb: 0.5 }}>Linked children for Subs</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>This canonical relationship controls leader-family Subs eligibility. It does not grant Parent Portal access.</Typography>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
      <TextField select fullWidth label="Child member" value={childToLink} onChange={(e) => setChildToLink(e.target.value)}>
        <MenuItem value="">Select child</MenuItem>{familyMembers.filter((member) => !linkedChildIds.includes(member.id)).map((member) => <MenuItem key={member.id} value={member.id}>{member.displayName} · {member.section}</MenuItem>)}
      </TextField>
      <Button variant="outlined" disabled={!childToLink || familyWorking} onClick={linkChild}>Link child</Button>
    </Stack>
    <Stack spacing={1} sx={{ mt: 1.5 }}>{linkedChildIds.map((memberId) => {
      const member = familyMembers.find((item) => item.id === memberId);
      return <Box key={memberId} sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
        <Typography>{member?.displayName || memberId}{member ? ` · ${member.section}` : ""}</Typography>
        <Button color="error" size="small" disabled={familyWorking} onClick={() => unlinkChild(memberId)}>Unlink</Button>
      </Box>;
    })}</Stack>
    {linkedChildIds.length === 0 && <Alert severity="info" sx={{ mt: 1.5 }}>No children are linked to this leader.</Alert>}
  </Box>;
}
