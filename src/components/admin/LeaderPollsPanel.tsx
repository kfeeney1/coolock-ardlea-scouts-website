import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Checkbox, CircularProgress, FormControl, FormControlLabel, FormGroup, MenuItem, Paper, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { applicationErrorMessage, reportApplicationError } from "../../services/applicationErrors.ts";
import { useAdminAuth } from "./AdminAuthProvider";
import { closePoll, createPollDraft, loadLeaderPolls, loadMyPollResponse, loadPollResultsForManager, publishPoll, submitPollResponse, subscribeToPollResults } from "../../services/polls.ts";
import { canManagePollForLeader, canRespondToPoll, GROUP_POLL_SECTIONS, pollDeadlinePassed, pollDraftFailureMessage, type PollLeaderActor, type PollRecord } from "../../services/pollLogic.ts";

type Results = Array<{ option: string; count: number }>;

function actorFor(uid: string, role: string, sections: string[], scoutingRole: string): PollLeaderActor {
  return { uid, role, sections, scoutingRole };
}

export default function LeaderPollsPanel({ showTitle = true }: { showTitle?: boolean }) {
  const { adminProfile } = useAdminAuth();
  const actor = useMemo(() => adminProfile ? actorFor(adminProfile.uid, adminProfile.role, adminProfile.sections, adminProfile.scoutingRole) : null, [adminProfile]);
  const groupManager = Boolean(actor && (actor.role === "admin" || actor.role === "super-admin" || canManagePollForLeader({ scopeType: "group", scopeSections: [...GROUP_POLL_SECTIONS] }, actor)));
  const [polls, setPolls] = useState<PollRecord[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, Results>>({});
  const [voterResults, setVoterResults] = useState<Record<string, Results>>({});
  const [resultErrors, setResultErrors] = useState<Record<string, string>>({});
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
  const createRequestId = useRef<string | null>(null);
  const createInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!actor) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const loaded = await loadLeaderPolls(actor);
      setPolls(loaded);
      const eligibleLeaderPolls = loaded.filter((poll) => canRespondToPoll(poll, { kind: "leader", sections: actor.sections }));
      const responses = await Promise.all(eligibleLeaderPolls.map(async (poll) => [poll.id, await loadMyPollResponse(poll.id)] as const));
      const next: Record<string, string> = {};
      responses.forEach(([id, response]) => { if (response) next[id] = response.option; });
      setAnswers((current) => ({ ...current, ...next }));
      setSavedAnswers(next);
      setSaved((current) => ({ ...current, ...Object.fromEntries(responses.map(([id, response]) => [id, Boolean(response)])) }));
    } catch (loadError) {
      setError(applicationErrorMessage(loadError, "Polls could not be loaded for your authorised sections.", "LeaderPollsPanel"));
    } finally {
      setLoading(false);
    }
  }, [actor]);
  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!actor) return undefined;
    const votedPolls = polls.filter((poll) => saved[poll.id] && poll.audienceType === "leaders"
      && poll.scopeSections.some((section) => actor.sections.includes(section)));
    const unsubscribe = votedPolls.map((poll) => subscribeToPollResults(poll,
      (aggregate) => {
        setVoterResults((current) => ({ ...current, [poll.id]: aggregate }));
        setResultErrors((current) => ({ ...current, [poll.id]: "" }));
      },
      (resultError) => setResultErrors((current) => ({
        ...current,
        [poll.id]: applicationErrorMessage(resultError, "Poll results could not be refreshed. Retry to check for the latest totals.", "LeaderPollsPanel")
      }))));
    return () => unsubscribe.forEach((stop) => stop());
  }, [actor, polls, saved]);

  useEffect(() => {
    if (scopeType === "sections" && selectedSections.length === 0 && adminProfile?.sections.length) {
      setSelectedSections(adminProfile.sections.filter((section) => GROUP_POLL_SECTIONS.includes(section as typeof GROUP_POLL_SECTIONS[number])));
    }
  }, [scopeType, selectedSections.length, adminProfile?.sections]);

  const createDraft = async () => {
    if (!actor || createInFlight.current) return;
    createInFlight.current = true;
    const requestId = createRequestId.current ?? crypto.randomUUID();
    createRequestId.current = requestId;
    setBusy((current) => ({ ...current, create: true }));
    setError("");
    setMessage("");
    try {
      await createPollDraft(actor, { question, options: optionsText.split("\n"), audienceType, scopeType, sections: scopeType === "group" ? [...GROUP_POLL_SECTIONS] : selectedSections, closesAt }, requestId);
      createRequestId.current = null;
      setQuestion("");
      setOptionsText("");
      setClosesAt("");
      setMessage("Poll draft saved. Review it below and publish it when ready.");
      await refresh();
    } catch (createError) {
      try {
        const savedDespiteLostAcknowledgement = (await loadLeaderPolls(actor)).some((poll) => poll.id === requestId);
        if (savedDespiteLostAcknowledgement) {
          createRequestId.current = null;
          setQuestion("");
          setOptionsText("");
          setClosesAt("");
          setMessage("Poll draft saved. Review it below and publish it when ready.");
          await refresh();
          return;
        }
      } catch {
        // Keep the original save failure if the recovery read also fails.
      }
      reportApplicationError(createError, { area: "LeaderPollsPanel", operation: "Save poll draft", userMessage: "The poll draft could not be saved." });
      setError(pollDraftFailureMessage(createError));
    } finally {
      createInFlight.current = false;
      setBusy((current) => ({ ...current, create: false }));
    }
  };

  const changeDraft = <Value,>(setValue: (value: Value) => void, value: Value) => {
    createRequestId.current = null;
    setValue(value);
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
      const response = answers[poll.id];
      await submitPollResponse(poll, response);
      setSavedAnswers((current) => ({ ...current, [poll.id]: response }));
      setSaved((current) => ({ ...current, [poll.id]: true }));
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Your poll response could not be saved.", "LeaderPollsPanel"));
    } finally {
      setBusy((current) => ({ ...current, [poll.id]: false }));
    }
  };

  if (!adminProfile) return null;
  const manageable = polls.filter((poll) => actor && canManagePollForLeader(poll, actor));
  const leaderAudience = polls.filter((poll) => actor && canRespondToPoll(poll, { kind: "leader", sections: actor.sections }));
  return <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, mb: 3 }} data-testid="leader-polls">
    {showTitle && <Typography component="h2" variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>Group Polls</Typography>}
    {error && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{error}<Button onClick={() => void refresh()}>Retry</Button></Alert>}
    {message && <Alert severity="success" role="status" sx={{ mb: 2 }}>{message}</Alert>}
    {loading ? <Stack direction="row" spacing={1} sx={{ alignItems: "center" }} role="status"><CircularProgress size={20} /><Typography>Loading active polls…</Typography></Stack> : <Stack spacing={1.5} sx={{ mb: 3 }} data-testid="leader-active-polls">
      {leaderAudience.length > 0 ? <>
        <Typography component="h3" variant="h6">Active polls</Typography>
        {leaderAudience.map((poll) => {
          const closed = pollDeadlinePassed(poll.closesAt);
          const aggregate = voterResults[poll.id];
          const total = aggregate?.reduce((sum, item) => sum + item.count, 0) ?? 0;
          return <Paper key={poll.id} variant="outlined" sx={{ p: 2 }} data-testid={`leader-poll-${poll.id}`}>
            <Typography sx={{ fontWeight: 800 }}>{poll.question}</Typography>
            <Typography variant="body2" color="text.secondary">{poll.scopeType === "group" ? "Group poll" : poll.scopeSections.join(", ")}</Typography>
            {closed && <Alert severity="info" sx={{ my: 1 }}>This poll has passed its closing time.</Alert>}
            {saved[poll.id] && <Alert severity="success" role="status" sx={{ my: 1 }}>Your response is saved. Saved choice: {savedAnswers[poll.id] || "your saved response"}. You may change it while the poll is open.</Alert>}
            <RadioGroup aria-label={`Answer options for ${poll.question}`} value={answers[poll.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [poll.id]: event.target.value }))}>{poll.options.map((option) => <FormControlLabel key={option} value={option} control={<Radio />} label={option} disabled={closed || busy[poll.id]} />)}</RadioGroup>
            <Button variant="contained" color="success" disabled={closed || busy[poll.id] || !answers[poll.id]} onClick={() => void saveResponse(poll)}>{busy[poll.id] ? "Saving…" : saved[poll.id] ? "Save changed response" : "Save response"}</Button>
            {saved[poll.id] && !voterResults[poll.id] && !resultErrors[poll.id] && <Typography role="status" sx={{ mt: 1 }}>Loading current results…</Typography>}
            {saved[poll.id] && resultErrors[poll.id] && <Alert severity="warning" role="alert" sx={{ mt: 1 }}>{resultErrors[poll.id]} <Button onClick={() => { setResultErrors((current) => ({ ...current, [poll.id]: "" })); void refresh(); }}>Retry results</Button></Alert>}
            {saved[poll.id] && aggregate && <Stack spacing={0.5} sx={{ mt: 1 }} data-testid={`leader-poll-audience-results-${poll.id}`}>
              <Typography variant="subtitle2">Current results · {total} response(s)</Typography>
              {aggregate.map((item) => <Typography key={item.option} variant="body2">{item.option}: {item.count} ({total ? Math.round(item.count * 100 / total) : 0}%)</Typography>)}
            </Stack>}
          </Paper>;
        })}
      </> : <Alert severity="info" data-testid="leader-polls-empty">There are no active polls for your sections right now.</Alert>}
    </Stack>}
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
    {!groupManager && <Alert severity="info" sx={{ mb: 2 }}>You can create and manage polls for your assigned sections. Group-wide polls require group leadership or admin access.</Alert>}
    <Stack spacing={1.5} sx={{ mb: 3 }} data-testid="poll-create-form">
      <Typography component="h3" variant="h6">Create a poll</Typography>
      <TextField label="Poll question" value={question} onChange={(event) => changeDraft(setQuestion, event.target.value)} helperText="Enter a question of 1 to 240 characters." slotProps={{ htmlInput: { maxLength: 240 } }} required />
      <TextField label="Answer options" value={optionsText} onChange={(event) => changeDraft(setOptionsText, event.target.value)} multiline minRows={3} helperText="Enter one answer per line. Use 2 to 8 distinct answers." />
      <TextField select label="Poll audience" value={audienceType} onChange={(event) => changeDraft(setAudienceType, event.target.value as "leaders" | "parents")}><MenuItem value="leaders">Leaders</MenuItem><MenuItem value="parents">Parents and guardians</MenuItem></TextField>
      <TextField select label="Poll scope" value={scopeType} onChange={(event) => setScopeType(event.target.value as "group" | "sections")}>{groupManager && <MenuItem value="group">Whole group</MenuItem>}<MenuItem value="sections">Selected sections</MenuItem></TextField>
      {scopeType === "sections" && <FormControl component="fieldset"><Typography variant="body2" sx={{ mb: 0.5 }}>Sections in scope</Typography><FormGroup row>{(groupManager ? GROUP_POLL_SECTIONS : adminProfile.sections).map((section) => <FormControlLabel key={section} label={section} control={<Checkbox checked={selectedSections.includes(section)} onChange={(event) => changeDraft(setSelectedSections, event.target.checked ? [...new Set([...selectedSections, section])] : selectedSections.filter((value) => value !== section))} />} />)}</FormGroup></FormControl>}
      <TextField type="datetime-local" label="Optional closing date and time" value={closesAt} onChange={(event) => changeDraft(setClosesAt, event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <Button variant="contained" color="success" disabled={busy.create || !question.trim() || optionsText.split("\n").map((option) => option.trim()).filter(Boolean).length < 2 || (scopeType === "sections" && selectedSections.length === 0)} onClick={() => void createDraft()}>{busy.create ? "Saving…" : "Save draft"}</Button>
      <Typography variant="body2" color="text.secondary">Saving a draft does not publish it. Only publish makes the poll visible to its audience.</Typography>
    </Stack>
  </Paper>;
}
