import { Alert, Box, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { loadParentWeeklyMeetingProgrammes } from "../../services/weeklyMeetingProgramme";
import type { ParentWeeklyMeetingProgramme } from "../../services/weeklyMeetingProgramme";

type Props = { sections: string[] };

const displayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(date);
};

export default function ParentWeeklyProgramme({ sections }: Props) {
  const [meetings, setMeetings] = useState<ParentWeeklyMeetingProgramme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const records = await loadParentWeeklyMeetingProgrammes(sections);
        if (!cancelled) setMeetings(records);
      } catch (loadError) {
        console.error("Unable to load parent weekly programme:", loadError);
        if (!cancelled) setError("Unable to load weekly meeting programmes right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sections]);

  return (
    <Box id="parent-weekly-programme" sx={{ mt: 3, scrollMarginTop: 24 }} data-testid="parent-weekly-programme">
      <Typography variant="h5" color="secondary" sx={{ mb: 0.5, fontWeight: 800 }}>Weekly Meeting Programme</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Parent view shows programme and planned badgework only. Attendance, completed badgework, incidents, subs and leader notes are never included here.
      </Typography>
      {loading ? (
        <Box sx={{ minHeight: 100, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : meetings.length === 0 ? (
        <Alert severity="info">No weekly meeting programme has been published for your linked section yet.</Alert>
      ) : (
        <Stack spacing={2}>
          {meetings.slice(0, 8).map((meeting) => (
            <Paper key={meeting.id} variant="outlined" sx={{ p: 2 }} data-testid={`parent-weekly-meeting-${meeting.id}`}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{displayDate(meeting.meetingDate)} · {meeting.section}</Typography>
                  {meeting.theme && <Typography color="text.secondary">Theme: {meeting.theme}</Typography>}
                  {meeting.location && <Typography color="text.secondary">Location: {meeting.location}</Typography>}
                </Box>
                <Chip size="small" label={meeting.status === "open" ? "Planned / Open" : "Completed"} />
              </Stack>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mt: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 800, mb: 0.75 }}>Activities / Games</Typography>
                  {meeting.activities.length ? meeting.activities.map((item, index) => (
                    <Typography key={`${item.name}-${index}`} variant="body2">• {item.name}{item.durationMinutes ? ` · ${item.durationMinutes} min` : ""}</Typography>
                  )) : <Typography variant="body2" color="text.secondary">No activities listed.</Typography>}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, mb: 0.75 }}>Badgework</Typography>
                  {meeting.badgework.length ? meeting.badgework.map((item, index) => (
                    <Typography key={`${item.name}-${index}`} variant="body2">• {item.name}{item.durationMinutes ? ` · ${item.durationMinutes} min` : ""}</Typography>
                  )) : <Typography variant="body2" color="text.secondary">No badgework listed.</Typography>}
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
