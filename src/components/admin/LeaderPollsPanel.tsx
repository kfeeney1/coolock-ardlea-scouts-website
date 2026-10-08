import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, CircularProgress, FormControl, FormControlLabel, FormGroup, MenuItem, Paper, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import { useAdminAuth } from "./AdminAuthProvider";
import { closePoll, createPollDraft, loadLeaderPolls, loadMyPollResponse, loadPollResultsForManager, publishPoll, submitPollResponse } from "../../services/polls.ts";
import { canManagePollForLeader, GROUP_POLL_SECTIONS, pollDeadlinePassed, type PollLeaderActor, type PollRecord } from "../../services/pollLogic.ts";

type Results = Array<{ option: string; count: number }>;

function actorFor(uid: string, role: string, sections: string[], scoutingRole: string): PollLeaderActor {
  return { uid, role, sections, scoutingRole };
}

export default function LeaderPollsPanel() {
  const { adminProfile } = useAdminAuth();
  const actor = useMemo(() => adminProfile ? actorFor(adminProfile.uid, adminProfile.role, adminProfile.sections, adminProfile.scoutingRole) : null, [adminProfile]);
  const groupManager = Boolean(actor && (actor.role === "admin" || actor.role === "super-admin" || canManagePollForLeader({ scopeType: "group", scopeSections: [...GROUP_POLL_SECTIONS] }, actor)));
  const [polls, setPolls] = useState<PollRecord[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, Results>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [question, setQuestion] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [audienceType, setAudienceType] = useState<"leaders" | "parents">("leaders");
  const [scopeType, setScopeType] = useState<"group" | "sections">("sections");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [closesAt, setClosesAt] = useState("");

  const refresh = useCallback(async () => {
    if (!actor) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const loaded = await loadLeaderPolls(actor);
      setPolls(loaded);
      const responses = await Promise.all(loaded.filter((poll) => poll.audienceType === "leaders" && poll.status === "published").map(async (poll) => [poll.id, await loadMyPollResponse(poll.id)] as const));
      const next: Record<string, string> = {};
      responses.forEach(([id, response]) => { if (response) next[id] = response.option; });
      setAnswers((current) => ({ ...current, ...next }));
      setSaved((current) => ({ ...current, ...Object.fromEntries(responses.map(([id, response]) => [id, Boolean(response)])) }));
    } catch (loadError) {
      setError(applicationErrorMessage(loadError, "Polls could not be loaded for your authorised sections.", "LeaderPollsPanel"));
    } finally {
      setLoading(false);
    }
  }, [actor]);
  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (scopeType === "sections" && selectedSections.length === 0 && adminProfile?.sections.length) {
      setSelectedSections([...adminProfile.sections]);
    }
  }, [scopeType, selectedSections.length, adminProfile?.sections]);

  const createDraft = async () => {
    if (!actor) return;
    setBusy((current) => ({ ...current, create: true }));
    setError("");
    setMessage("");
    try {
      await createPollDraft(actor, { question, options: optionsText.split("\n"), audienceType, scopeType, sections: scopeType === "group" ? [...GROUP_POLL_SECTIONS] : selectedSections, closesAt });
      setQuestion("");
      setOptionsText("");
      setClosesAt("");
      setMessage("Poll draft saved. Review it below and publish it when ready.");
      await refresh();
    } catch (createError) {
      setError(applicationErrorMessage(createError, "The poll draft could not be saved.", "LeaderPollsPanel"));
    } finally {
      setBusy((current) => ({ ...current, create: false }));
    }
  };

  const manage = async (poll: PollRecord, action: "publish" | "close") => {
    if (!actor) return;
    setBusy((current) => ({ ...current, [poll.id]: true }));
    setError("");
    try {
      if (action === "publish") await publishPoll(actor, poll);
      else await closePoll(actor, poll);
      setMessage(action === "publish" ? "Poll published." : "Poll closed. New responses are no longer accepted.");
      await refresh();
    } catch (manageError) {
      setError(applicationErrorMessage(manageError, "The poll could not be updated.", "LeaderPollsPanel"));
    } finally {
      setBusy((current) => ({ ...current, [poll.id]: false }));
    }
  };

  const viewResults = async (poll: PollRecord) => {
    if (!actor || !canManagePollForLeader(poll, actor)) return;
    setBusy((current) => ({ ...current, [poll.id]: true }));
    setError("");
    try {
      const aggregate = await loadPollResultsForManager(poll);
      setResults((current) => ({ ...current, [poll.id]: aggregate }));
    } catch (resultsError) {
      setError(applicationErrorMessage(resultsError, "Results are unavailable outside your authorised management scope.", "LeaderPollsPanel"));
    } finally {
      setBusy((current) => ({ ...current, [poll.id]: false }));
    }
  };

  const saveResponse = async (poll: PollRecord) => {
    if (!actor || !answers[poll.id]) return;
    setBusy((current) => ({ ...current, [poll.id]: true }));
    setError("");
    try {
      await submitPollResponse(poll, answers[poll.id]);
      setSaved((current) => ({ ...current, [poll.id]: true }));
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Your poll response could not be saved.", "LeaderPollsPanel"));
    } finally {
      setBusy((current) => ({ ...current, [poll.id]: false }));
    }
  };

  if (!adminProfile) return null;
  const manageable = polls.filter((poll) => actor && canManagePollForLeader(poll, actor));
  const leaderAudience = polls.filter((poll) => poll.audienceType === "leaders" && poll.status === "published");
  return <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, mb: 3 }} data-testid="leader-polls">
    <Typography component="h2" variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>Group Polls</Typography>
    {error && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="success" role="status" sx={{ mb: 2 }}>{message}</Alert>}
    <Stack spacing={1.5} sx={{ mb: 3 }} data-testid="poll-create-form">
      <Typography component="h3" variant="h6">Create a poll</Typography>
      <TextField label="Poll question" value={question} onChange={(event) => setQuestion(event.target.value)} slotProps={{ htmlInput: { maxLength: 240 } }} required />
      <TextField label="Answer options" value={optionsText} onChange={(event) => setOptionsText(event.target.value)} multiline minRows={3} helperText="Enter one answer per line. Use 2 to 8 distinct answers." />
      <TextField select label="Poll audience" value={audienceType} onChange={(event) => setAudienceType(event.target.value as "leaders" | "parents")}>
        <MenuItem value="leaders">Leaders</MenuItem><MenuItem value="parents">Parents and guardians</MenuItem>
      </TextField>
      <TextField select label="Poll scope" value={scopeType} onChange={(event) => setScopeType(event.target.value as "group" | "sections")}>
        {groupManager && <MenuItem value="group">Whole group</MenuItem>}<MenuItem value="sections">Selected sections</MenuItem>
      </TextField>
      {scopeType === "sections" && <FormControl component="fieldset"><Typography variant="body2" sx={{ mb: 0.5 }}>Sections in scope</Typography><FormGroup row>{(groupManager ? GROUP_POLL_SECTIONS : adminProfile.sections).map((section) => <FormControlLabel key={section} label={section} control={<Checkbox checked={selectedSections.includes(section)} onChange={(event) => setSelectedSections((current) => event.target.checked ? [...new Set([...current, section])] : current.filter((value) => value !== section))} />} />)}</FormGroup></FormControl>}
      <TextField type="datetime-local" label="Optional closing date and time" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <Button variant="contained" color="success" disabled={busy.create || !question.trim() || optionsText.split("\n").map((option) => option.trim()).filter(Boolean).length < 2 || (scopeType === "sections" && selectedSections.length === 0)} onClick={() => void createDraft()}>{busy.create ? "Saving…" : "Save draft"}</Button>
      <Typography variant="body2" color="text.secondary">Saving a draft does not publish it. Only publish makes the poll visible to its audience.</Typography>
    </Stack>
    {!groupManager && <Alert severity="info" sx={{ mb: 2 }}>You can create and manage polls for your assigned sections. Group-wide polls require group leadership or admin access.</Alert>}
    {loading ? <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><CircularProgress size={20} /><Typography>Loading polls…</Typography></Stack> : <>
      {manageable.length > 0 && <Stack spacing={1.5} sx={{ mb: 3 }}>
        <Typography component="h3" variant="h6">Poll management</Typography>
        {manageable.map((poll) => <Paper key={poll.id} variant="outlined" sx={{ p: 2 }} data-testid={`leader-poll-manager-${poll.id}`}>
          <Typography sx={{ fontWeight: 800 }}>{poll.question}</Typography>
          <Typography variant="body2" color="text.secondary">{poll.audienceType === "parents" ? "Parents and guardians" : "Leaders"} · {poll.scopeType === "group" ? "Whole group" : poll.scopeSections.join(", ")} · {poll.status}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
            {poll.status === "draft" && <Button disabled={busy[poll.id]} onClick={() => void manage(poll, "publish")}>Publish poll</Button>}
            {poll.status === "published" && <Button disabled={busy[poll.id]} onClick={() => void manage(poll, "close")}>Close poll</Button>}
            {poll.status !== "draft" && <Button disabled={busy[poll.id]} onClick={() => void viewResults(poll)}>View results</Button>}
          </Stack>
          {results[poll.id] && <Stack spacing={0.5} sx={{ mt: 1 }} data-testid={`poll-results-${poll.id}`}>
            <Typography variant="subtitle2">Results · {results[poll.id].reduce((sum, item) => sum + item.count, 0)} response(s)</Typography>
            {results[poll.id].map((result) => <Typography key={result.option} variant="body2">{result.option}: {result.count}</Typography>)}
          </Stack>}
        </Paper>)}
      </Stack>}
      {leaderAudience.length > 0 ? <Stack spacing={1.5}>
        <Typography component="h3" variant="h6">Polls for your sections</Typography>
        {leaderAudience.map((poll) => {
          const closed = poll.status !== "published" || pollDeadlinePassed(poll.closesAt);
          return <Paper key={poll.id} variant="outlined" sx={{ p: 2 }} data-testid={`leader-poll-${poll.id}`}>
            <Typography sx={{ fontWeight: 800 }}>{poll.question}</Typography>
            <Typography variant="body2" color="text.secondary">{poll.scopeType === "group" ? "Group poll" : poll.scopeSections.join(", ")}</Typography>
            {closed && <Alert severity="info" sx={{ my: 1 }}>This poll is closed.</Alert>}
            {saved[poll.id] && <Alert severity="success" role="status" sx={{ my: 1 }}>Your response is saved. You may change it while the poll is open.</Alert>}
            <RadioGroup value={answers[poll.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [poll.id]: event.target.value }))}>{poll.options.map((option) => <FormControlLabel key={option} value={option} control={<Radio />} label={option} disabled={closed || busy[poll.id]} />)}</RadioGroup>
            <Button variant="contained" color="success" disabled={closed || busy[poll.id] || !answers[poll.id]} onClick={() => void saveResponse(poll)}>{busy[poll.id] ? "Saving…" : saved[poll.id] ? "Save changed response" : "Save response"}</Button>
          </Paper>;
        })}
      </Stack> : !manageable.some((poll) => poll.status === "draft") && <Alert severity="info">No active polls are available for your sections.</Alert>}
    </>}
  </Paper>;
}
