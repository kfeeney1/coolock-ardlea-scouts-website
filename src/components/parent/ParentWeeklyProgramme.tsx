import { reportApplicationError } from "../../services/applicationErrors.ts";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

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
import { formatSiteDate } from "../../services/siteDateFormat";
import { groupLocalDate } from "../../services/groupLocalDate";
import { groupParentMeetingsByDate } from "../../services/weeklyMeetingProgrammeLogic";

type Props = { sections: string[]; childId: string };

const displayDate = (value: string) => formatSiteDate(value);

function parentProgrammePath(childId: string, historical: boolean, search: string): string {
  const params = new URLSearchParams(search);
  if (childId) params.set("child", childId);
  else params.delete("child");
  params.delete("joinToken");
  if (historical) params.set("meetings", "history");
  else params.delete("meetings");
  const query = params.toString();
  return `/parent${query ? `?${query}` : ""}#parent-weekly-programme`;
}

export default function ParentWeeklyProgramme({ sections, childId }: Props) {
  const [meetings, setMeetings] = useState<ParentWeeklyMeetingProgramme[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const location = useLocation();
  const historicalView = new URLSearchParams(location.search).get("meetings") === "history";
  const views = groupParentMeetingsByDate(meetings, groupLocalDate());

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
        reportApplicationError(error, { area: "ParentWeeklyProgramme", operation: "Unable to load parent weekly programme" });
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
      ) : (
        historicalView ? (
          <Stack spacing={2} data-testid="parent-weekly-history">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
              <Typography component="h3" variant="h6" sx={{ fontWeight: 800 }}>Historical meetings</Typography>
              <Button component={Link} to={parentProgrammePath(childId, false, location.search)} replace aria-label="Back to weekly meeting programme">
                Back to weekly programme
              </Button>
            </Stack>
            {views.historical.length ? views.historical.map((meeting) => renderMeeting(meeting)) : (
              <OperationalEmptyState title="No historical meetings">
                There are no older weekly meetings for your linked section.
              </OperationalEmptyState>
            )}
          </Stack>
        ) : (
          <Stack spacing={2} data-testid="parent-weekly-default">
            <Box component="section" aria-labelledby="parent-upcoming-meetings-heading">
              <Typography id="parent-upcoming-meetings-heading" component="h3" variant="h6" sx={{ mb: 1, fontWeight: 800 }}>Upcoming meetings</Typography>
              {views.upcoming.length ? <Stack spacing={2}>{views.upcoming.map((meeting) => renderMeeting(meeting))}</Stack> : (
                <OperationalEmptyState title="No upcoming meetings">There are no upcoming weekly meetings for your linked section.</OperationalEmptyState>
              )}
            </Box>
            <Box component="section" aria-labelledby="parent-previous-meeting-heading">
              <Typography id="parent-previous-meeting-heading" component="h3" variant="h6" sx={{ mb: 1, fontWeight: 800 }}>Most recent previous meeting</Typography>
              {views.previous.length ? <Stack spacing={2}>{views.previous.map((meeting) => renderMeeting(meeting))}</Stack> : (
                <OperationalEmptyState title="No previous meeting">There is no previous weekly meeting for your linked section.</OperationalEmptyState>
              )}
            </Box>
            <Button component={Link} to={parentProgrammePath(childId, true, location.search)} variant="outlined" color="secondary" sx={{ alignSelf: "flex-start", minHeight: 48 }} data-testid="view-historical-meetings">
              View historical meetings
            </Button>
          </Stack>
        )
      )}
    </Box>
  );
}

function renderMeeting(meeting: ParentWeeklyMeetingProgramme) {
  return (
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
  );
}
