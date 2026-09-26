import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { MemberRecord } from "../../services/memberAdmin";
import { createSubsFamilyAccount } from "../../services/subsLedger";
import { loadLeaderChildRelationshipsForMembers } from "../../services/leaderChildRelationships";
import { familyTotalFor, familyTypeForLeaderRelationships, familyTypeLabel, formatEuro, scoutYearPeriodForDate, type SubsAssignment, type SubsFamilyType, type SubsRatePolicy } from "../../services/subsLogic";

type Props = {
  members: MemberRecord[];
  policies: SubsRatePolicy[];
  assignments: SubsAssignment[];
  defaultPolicyId: string;
  saving: boolean;
  onSaving: (value: boolean) => void;
  onMessage: (value: string) => void;
  onError: (value: string) => void;
  onReload: () => Promise<void>;
};

export default function SubsFamilyAccountPanel({ members, policies, assignments, defaultPolicyId, saving, onSaving, onMessage, onError, onReload }: Props) {
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [policyId, setPolicyId] = useState(defaultPolicyId);
  const [familyType, setFamilyType] = useState<SubsFamilyType>("standard");
  const [classificationNote, setClassificationNote] = useState("");
  const effectivePolicyId = policyId && policies.some((policy) => policy.id === policyId)
    ? policyId
    : defaultPolicyId && policies.some((policy) => policy.id === defaultPolicyId)
      ? defaultPolicyId
      : "";
  const selectedPolicy = policies.find((policy) => policy.id === effectivePolicyId);
  useEffect(() => {
    if (effectivePolicyId && policyId !== effectivePolicyId) setPolicyId(effectivePolicyId);
  }, [effectivePolicyId, policyId]);
  const selectedMembers = useMemo(
    () => memberIds.map((id) => members.find((member) => member.id === id)).filter((member): member is MemberRecord => Boolean(member)),
    [memberIds, members]
  );
  const existingAssignments = selectedPolicy
    ? assignments.filter((assignment) => memberIds.includes(assignment.memberId) && assignment.period === selectedPolicy.period)
    : [];
  let total: number | null = null;
  let rateError = "";
  if (selectedPolicy && selectedMembers.length) {
    try {
      total = familyTotalFor(selectedPolicy, familyType, selectedMembers.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rate not configured";
      rateError = message.startsWith("Rate not configured") ? "Rate not configured" : message;
    }
  }

  const submit = async () => {
    if (!selectedPolicy || !selectedMembers.length || total === null) return;
    onSaving(true);
    onMessage("");
    onError("");
    try {
      const isCurrentYear = selectedPolicy.period === scoutYearPeriodForDate(new Date().toISOString().slice(0, 10));
      const relationships = isCurrentYear ? await loadLeaderChildRelationshipsForMembers(selectedMembers.map((member) => member.id)) : [];
      const effectiveFamilyType = isCurrentYear ? familyTypeForLeaderRelationships(selectedMembers.map((member) => member.id), relationships) : familyType;
      const evidence = isCurrentYear ? "Automatically derived from canonical active leader-child relationships." : classificationNote;
      await createSubsFamilyAccount(selectedMembers, selectedPolicy, effectiveFamilyType, evidence);
      onMessage(`${familyTypeLabel(effectiveFamilyType)} billing account created for ${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"}.`);
      setMemberIds([]);
      setClassificationNote("");
      await onReload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to create family billing account.");
    } finally {
      onSaving(false);
    }
  };

  return <Box sx={{ mt: 5 }} data-testid="subs-family-account-panel">
    <Typography variant="h6" sx={{ fontWeight: 800 }}>Family billing account</Typography>
    <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
      Select every member included in one Scout-year family classification, including members in different sections. The relationship is confirmed explicitly by an authorised finance officer; the system does not infer it from names or contact details.
    </Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
      <FormControl>
        <InputLabel id="subs-family-members-label">Family members</InputLabel>
        <Select multiple labelId="subs-family-members-label" label="Family members" value={memberIds}
          onChange={(event) => setMemberIds(typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value)}
          renderValue={(selected) => `${selected.length} member${selected.length === 1 ? "" : "s"} selected`} data-testid="subs-family-members">
          {members.map((member) => <MenuItem key={member.id} value={member.id}>{member.displayName} · {member.section}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl>
        <InputLabel>Scout year policy</InputLabel>
        <Select label="Scout year policy" value={effectivePolicyId} onChange={(event) => setPolicyId(event.target.value)}>
          {policies.map((policy) => <MenuItem key={policy.id} value={policy.id}>{policy.period} · v{policy.version}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl>
        <InputLabel>Family classification</InputLabel>
        <Select label="Family classification" value={familyType} onChange={(event) => setFamilyType(event.target.value as SubsFamilyType)}
          disabled={selectedPolicy?.period === scoutYearPeriodForDate(new Date().toISOString().slice(0, 10))}>
          <MenuItem value="standard">Standard family</MenuItem><MenuItem value="leader">Leader family</MenuItem>
        </Select>
      </FormControl>
    </Box>
    <TextField fullWidth sx={{ mt: 2 }} label="Classification evidence" value={classificationNote}
      onChange={(event) => setClassificationNote(event.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }}
      helperText={selectedPolicy?.period === scoutYearPeriodForDate(new Date().toISOString().slice(0, 10)) ? "Current-year leader classification is derived automatically from canonical leader-child relationships." : "Record the controlled source or check used to confirm this historical family classification."} data-testid="subs-family-evidence" disabled={selectedPolicy?.period === scoutYearPeriodForDate(new Date().toISOString().slice(0, 10))} />
    {total !== null && <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
      <Chip label={`${selectedMembers.length}-member ${familyTypeLabel(familyType).toLowerCase()}`} />
      <Chip label={`Shared family total ${formatEuro(total)}`} />
      {[...new Set(selectedMembers.map((member) => member.section))].map((section) => <Chip key={section} label={section} />)}
    </Stack>}
    {policies.length === 0 && <Alert severity="error" sx={{ mt: 2 }}>No Scout year policy is available. Configure a Subs policy before creating a family billing account.</Alert>}
    {policies.length > 0 && !defaultPolicyId && !policyId && <Alert severity="error" sx={{ mt: 2 }}>No valid policy is active for the current Scout year. Select a historical policy only when intentionally working on that historical year, or configure the current Scout-year policy.</Alert>}
    {selectedPolicy && selectedMembers.length > 0 && rateError && <Alert severity="warning" sx={{ mt: 2 }}>The selected Scout year policy cannot price this family: {rateError}. Check the configured family rates.</Alert>}
    {existingAssignments.length > 0 && <Alert severity="warning" sx={{ mt: 2 }}>
      One or more selected members already has an immutable classification for this Scout year. Existing financial history is not overwritten.
    </Alert>}
    <Button variant="contained" sx={{ mt: 2.5 }} disabled={saving || !selectedPolicy || !selectedMembers.length || total === null || existingAssignments.length > 0 || (selectedPolicy?.period !== scoutYearPeriodForDate(new Date().toISOString().slice(0, 10)) && classificationNote.trim().length < 3)}
      onClick={() => void submit()} data-testid="subs-create-family-account">
      {saving ? "Saving…" : "Create family billing account"}
    </Button>
  </Box>;
}
