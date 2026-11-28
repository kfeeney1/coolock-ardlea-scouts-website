import { Alert, Box, Button, Container, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import DatePickerField from "../components/DatePickerField";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import { canViewJoinManagement, waitingListEntrySections } from "../security/joinManagementAccess";
import { applicationErrorMessage } from "../services/applicationErrors";
import { addWaitingListEntry, joinEmailPattern, joinPhonePattern } from "../services/joinApplications";
import type { WaitingListEntry } from "../services/joinApplications";

const fields = [
  { name: "childFirstName", label: "First name", maxLength: 80 },
  { name: "childLastName", label: "Last name", maxLength: 80 },
  { name: "parentName", label: "Parent / guardian name", maxLength: 150 },
  { name: "relationship", label: "Relationship", maxLength: 80 },
  { name: "mobileNumber", label: "Mobile number", maxLength: 20, type: "tel" },
  { name: "emailAddress", label: "Email address", maxLength: 254, type: "email" }
] as const;

export default function AddWaitingListEntry() {
  const { adminProfile } = useAdminAuth();
  const sections = waitingListEntrySections(adminProfile);
  const [section, setSection] = useState(() => sections.length === 1 ? sections[0] : "");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const pending = useRef<{ id: string; entry: WaitingListEntry } | null>(null);
  const backPath = canViewJoinManagement(adminProfile) ? "/leader/join?status=waiting-list" : "/leader";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const data = new FormData(event.currentTarget);
    const entry = { section, dateOfBirth } as WaitingListEntry;
    for (const { name } of fields) entry[name] = String(data.get(name) ?? "").trim();

    if (!pending.current && (!dateOfBirth || !sections.includes(section) || fields.some(({ name }) => !entry[name]))) {
      setError("Complete all fields and choose a date of birth and section.");
      return;
    }

    if (!pending.current && (!joinPhonePattern.test(entry.mobileNumber) || !joinEmailPattern.test(entry.emailAddress))) {
      setError("Enter a valid mobile number and email address.");
      return;
    }

    // Retry the same entry if the save outcome is uncertain.
    pending.current ??= { id: crypto.randomUUID(), entry };
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      await addWaitingListEntry(pending.current.entry, pending.current.id);
      setSaved(true);
    } catch (failure) {
      setError(applicationErrorMessage(failure, "Unable to confirm the save. Try again.", "AddWaitingListEntry"));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return <Container maxWidth="md" sx={{ py: { xs: 2, md: 5 } }}>
    <LeaderDashboardHeader />
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Typography component="h1" variant="h4" color="secondary" sx={{ mb: 2 }}>Add to waiting list</Typography>
      {saved ? <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Alert severity="success">Added to the waiting list.</Alert>
        <Button component={Link} to={backPath}>{backPath === "/leader" ? "Back to dashboard" : "View waiting list"}</Button>
      </Stack> : sections.length === 0 ? <Alert severity="warning">Your leader account needs a youth section or Group assignment to add entries.</Alert> :
        <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 2 }}>
          <Box component="fieldset" disabled={Boolean(pending.current)} sx={{ display: "grid", gap: 2, border: 0, m: 0, p: 0, minWidth: 0 }}>
            {fields.slice(0, 2).map((field) => <TextField key={field.name} required name={field.name} label={field.label} slotProps={{ htmlInput: { maxLength: field.maxLength } }} />)}
            <DatePickerField required label="Date of birth" name="dateOfBirth" value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)} disabled={Boolean(pending.current)} />
            <FormControl required disabled={Boolean(pending.current)}>
              <InputLabel id="waiting-list-section-label">Section</InputLabel>
              <Select labelId="waiting-list-section-label" label="Section" value={section} onChange={(event) => setSection(event.target.value)}>
                {sections.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
              </Select>
            </FormControl>
            {fields.slice(2).map((field) => <TextField key={field.name} required name={field.name} label={field.label}
              type={"type" in field ? field.type : "text"} slotProps={{ htmlInput: { maxLength: field.maxLength } }} />)}
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button type="submit" variant="contained" color="success" disabled={submitting}>{error && pending.current ? "Try again" : "Save waiting-list entry"}</Button>
            <Button component={Link} to={backPath} disabled={submitting}>Cancel</Button>
          </Stack>
        </Box>}
    </Paper>
  </Container>;
}
