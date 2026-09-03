import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import {
  OperationalEmptyState,
  OperationalErrorState,
  OperationalLoading,
  OperationalPermissionState,
  OperationalUnavailableState
} from "../admin/OperationalStates";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../../services/firestoreErrors";
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
  const [loadError, setLoadError] = useState<unknown>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  const retry = useCallback(() => setRetryVersion((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (sections.length === 0) {
        setMeetings([]);
        setLoadError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const records = await loadParentWeeklyMeetingProgrammes(sections);
        if (!cancelled) setMeetings(records);
      } catch (error) {
        console.error("Unable to load parent weekly programme:", error);
        if (!cancelled) setLoadError(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sections, retryVersion]);

  const failureKind = loadError ? classifyFirestoreFailure(loadError) : null;
  const failureMessage = loadError
    ? firestoreFailureMessage(loadError, "Unable to load weekly meeting programmes right now. Please try again.")
    : "";

  return (
    <Box id="parent-weekly-programme" sx={{ mt: 3, scrollMarginTop: 24 }} data-testid="parent-weekly-programme">
      <Typography variant="h5" color="secondary" sx={{ mb: 0.5, fontWeight: 800 }}>Weekly Meeting Programme</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Parent view shows programme and planned badgework only. Attendance, completed badgework, incidents, subs and leader notes are never included here.
      </Typography>
      {loading ? (
        <OperationalLoading minHeight={100} label="Loading weekly meeting programme" />
      ) : sections.length === 0 ? (
        <OperationalUnavailableState title="Weekly programme unavailable">
          A linked Scout section is needed before weekly meeting programme information can be shown. Contact the Scout Group if your child should already be linked to this account.
        </OperationalUnavailableState>
      ) : loadError && failureKind === "permission" ? (
        <OperationalPermissionState title="Weekly programme access unavailable" actionLabel="Retry" onAction={retry}>
          {failureMessage}
        </OperationalPermissionState>
      ) : loadError ? (
        <OperationalErrorState title="Weekly programme could not be loaded" actionLabel="Retry" onAction={retry}>
          {failureMessage}
        </OperationalErrorState>
      ) : meetings.length === 0 ? (
        <OperationalEmptyState title="No weekly programme yet">
          No weekly meeting programme has been published for your linked section yet.
        </OperationalEmptyState>
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
