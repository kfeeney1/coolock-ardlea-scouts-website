import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import type { MemberRecord } from "../../services/memberAdmin";
import { createSubsFamilyAccount } from "../../services/subsLedger";
import { familyTotalFor, familyTypeLabel, formatEuro, type SubsAssignment, type SubsFamilyType, type SubsRatePolicy } from "../../services/subsLogic";

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
  const selectedPolicy = policies.find((policy) => policy.id === (policyId || defaultPolicyId));
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
      await createSubsFamilyAccount(selectedMembers, selectedPolicy, familyType, classificationNote);
      onMessage(`${familyTypeLabel(familyType)} billing account created for ${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"}.`);
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
        <Select label="Scout year policy" value={policyId || defaultPolicyId} onChange={(event) => setPolicyId(event.target.value)}>
          {policies.map((policy) => <MenuItem key={policy.id} value={policy.id}>{policy.period} · v{policy.version}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl>
        <InputLabel>Family classification</InputLabel>
        <Select label="Family classification" value={familyType} onChange={(event) => setFamilyType(event.target.value as SubsFamilyType)}>
          <MenuItem value="standard">Standard family</MenuItem><MenuItem value="leader">Leader family</MenuItem>
        </Select>
      </FormControl>
    </Box>
    <TextField fullWidth sx={{ mt: 2 }} label="Classification evidence" value={classificationNote}
      onChange={(event) => setClassificationNote(event.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }}
      helperText="Record the controlled source or check used to confirm this family classification." data-testid="subs-family-evidence" />
    {total !== null && <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
      <Chip label={`${selectedMembers.length}-member ${familyTypeLabel(familyType).toLowerCase()}`} />
      <Chip label={`Shared family total ${formatEuro(total)}`} />
      {[...new Set(selectedMembers.map((member) => member.section))].map((section) => <Chip key={section} label={section} />)}
    </Stack>}
    {rateError && <Alert severity="warning" sx={{ mt: 2 }}>{rateError}</Alert>}
    {existingAssignments.length > 0 && <Alert severity="warning" sx={{ mt: 2 }}>
      One or more selected members already has an immutable classification for this Scout year. Existing financial history is not overwritten.
    </Alert>}
    <Button variant="contained" sx={{ mt: 2.5 }} disabled={saving || !selectedPolicy || !selectedMembers.length || total === null || existingAssignments.length > 0 || classificationNote.trim().length < 3}
      onClick={() => void submit()} data-testid="subs-create-family-account">
      {saving ? "Saving…" : "Create family billing account"}
    </Button>
  </Box>;
}
