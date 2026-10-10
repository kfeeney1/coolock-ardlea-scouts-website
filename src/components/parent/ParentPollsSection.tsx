import { formatSiteDateTime } from "../../services/siteDateFormat";
import { useEffect, useState } from "react";
import { Alert, Button, CircularProgress, FormControl, FormControlLabel, Paper, Radio, RadioGroup, Stack, Typography } from "@mui/material";
import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import { loadMyPollResponse, loadParentPolls, submitPollResponse } from "../../services/polls.ts";
import { pollDeadlinePassed, type PollRecord } from "../../services/pollLogic.ts";

type Props = { sections: string[] };

function formatClosingDate(value: unknown): string {
  const date = value instanceof Date ? value : typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function" ? value.toDate() as Date : new Date(value as string | number);
  return Number.isFinite(date.getTime()) ? formatSiteDateTime(date) : "date unavailable";
}

export default function ParentPollsSection({ sections }: Props) {
  const [polls, setPolls] = useState<PollRecord[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const loaded = await loadParentPolls(sections);
      setPolls(loaded);
      const responses = await Promise.all(loaded.map(async (poll) => [poll.id, await loadMyPollResponse(poll.id)] as const));
      const next: Record<string, string> = {};
      responses.forEach(([id, response]) => { if (response) next[id] = response.option; });
      setAnswers(next);
      setSaved(Object.fromEntries(responses.map(([id, response]) => [id, Boolean(response)])));
    } catch (loadError) {
      setError(applicationErrorMessage(loadError, "Active group polls could not be loaded.", "ParentPollsSection"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [sections.join("|")]);

  const save = async (poll: PollRecord) => {
    const option = answers[poll.id];
    if (!option) return;
    setBusy((current) => ({ ...current, [poll.id]: true }));
    setError("");
    try {
      await submitPollResponse(poll, option);
      setSaved((current) => ({ ...current, [poll.id]: true }));
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Your poll response could not be saved.", "ParentPollsSection"));
    } finally {
      setBusy((current) => ({ ...current, [poll.id]: false }));
    }
  };

  if (loading) return <Paper variant="outlined" sx={{ p: 2 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><CircularProgress size={20} /><Typography>Loading active polls…</Typography></Stack></Paper>;
  return <Stack spacing={2} data-testid="parent-polls">
    {error && <Alert severity="error" role="alert">{error}</Alert>}
    {polls.length === 0
      ? <Alert severity="info" data-testid="parent-polls-empty">There are no active polls for your linked sections right now.</Alert>
      : polls.map((poll) => {
        const closed = poll.status !== "published" || pollDeadlinePassed(poll.closesAt);
        return <Paper key={poll.id} variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }} data-testid={`parent-poll-${poll.id}`}>
          <Typography component="h3" variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{poll.question}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{poll.scopeType === "group" ? "Group poll" : `For ${poll.scopeSections.join(", ")}`}{poll.closesAt ? ` · Closes ${formatClosingDate(poll.closesAt)}` : ""}</Typography>
          {closed && <Alert severity="info" sx={{ mb: 1 }}>This poll is closed. New or changed responses are not accepted.</Alert>}
          {saved[poll.id] && <Alert severity="success" role="status" sx={{ mb: 1 }}>Your response is saved. You may change it while the poll is open.</Alert>}
          <FormControl component="fieldset" fullWidth disabled={closed || busy[poll.id]}>
            <RadioGroup name={`parent-poll-${poll.id}`} value={answers[poll.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [poll.id]: event.target.value }))}>
              {poll.options.map((option) => <FormControlLabel key={option} value={option} control={<Radio />} label={option} />)}
            </RadioGroup>
          </FormControl>
          <Button variant="contained" color="success" disabled={closed || busy[poll.id] || !answers[poll.id]} onClick={() => void save(poll)}>{busy[poll.id] ? "Saving…" : saved[poll.id] ? "Save changed response" : "Save response"}</Button>
        </Paper>;
      })}
  </Stack>;
}
