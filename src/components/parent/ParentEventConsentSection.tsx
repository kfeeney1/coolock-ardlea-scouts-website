import { Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  OperationalEmptyState,
  OperationalErrorState,
  OperationalLoading,
  OperationalPermissionState,
  OperationalUnavailableState
} from "../admin/OperationalStates";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../../services/firestoreErrors";
import { loadParentEventConsentLinks } from "../../services/parentEvents";
import type { ParentEventConsentLink } from "../../services/parentEvents";
import ParentEventGallerySection from "./ParentEventGallerySection";

type Props = { sections: string[] };

function formatDate(value: string): string {
  if (!value) return "Date not set";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(date);
}

export default function ParentEventConsentSection({ sections }: Props) {
  const [events, setEvents] = useState<ParentEventConsentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      setPermissionDenied(false);
      try {
        const loaded = await loadParentEventConsentLinks(sections);
        if (!cancelled) setEvents(loaded);
      } catch (loadError) {
        console.error("Unable to load parent event consent links:", loadError);
        if (!cancelled) {
          setPermissionDenied(classifyFirestoreFailure(loadError) === "permission");
          setError(firestoreFailureMessage(loadError, "Unable to load upcoming event consent requests."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sections, retryVersion]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? events.filter((event) =>
          [event.title, event.section, event.eventType, event.location, event.description]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : events;
  }, [events, search]);

  const retry = () => setRetryVersion((value) => value + 1);

  let eventConsentContent;
  if (loading) {
    eventConsentContent = <OperationalLoading minHeight={120} label="Loading upcoming event consent requests" />;
  } else if (error && permissionDenied) {
    eventConsentContent = (
      <OperationalPermissionState
        title="Event consent access restricted"
        actionLabel="Retry"
        onAction={retry}
        testId="parent-event-consent-permission"
      >
        {error}
      </OperationalPermissionState>
    );
  } else if (error) {
    eventConsentContent = (
      <OperationalErrorState
        title="Unable to load event consent"
        actionLabel="Retry"
        onAction={retry}
        testId="parent-event-consent-error"
      >
        {error}
      </OperationalErrorState>
    );
  } else if (sections.length === 0) {
    eventConsentContent = (
      <OperationalUnavailableState title="Event consent unavailable">
        No linked Scout section is available for this account yet.
      </OperationalUnavailableState>
    );
  } else if (events.length === 0) {
    eventConsentContent = (
      <OperationalEmptyState title="No upcoming consent requests">
        There are no upcoming consent requests for your linked sections at the moment.
      </OperationalEmptyState>
    );
  } else {
    eventConsentContent = (
      <Stack spacing={2}>
        <TextField
          fullWidth
          label="Search event consent"
          placeholder="Event, section or location"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{ htmlInput: { "data-testid": "parent-event-consent-search" } }}
        />
        <Typography variant="body2" color="text.secondary" role="status" aria-live="polite">
          Showing {visible.length} of {events.length} upcoming consent request{events.length === 1 ? "" : "s"}.
        </Typography>
        <Box
          sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}
          data-testid="parent-event-consent-tiles"
        >
          {visible.map((event) => (
            <Paper key={event.token} variant="outlined" sx={{ p: 2.5 }} data-testid={`parent-event-consent-tile-${event.token}`}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{event.title}</Typography>
                <Chip size="small" label={event.section} variant="outlined" />
                {event.eventType && <Chip size="small" label={event.eventType} />}
                <Chip size="small" color="warning" label="Consent required" />
              </Stack>
              <Typography sx={{ mt: 1, fontWeight: 700 }}>
                {formatDate(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ""}
              </Typography>
              {event.location && <Typography color="text.secondary">{event.location}</Typography>}
              {event.description && <Typography sx={{ mt: 1 }}>{event.description}</Typography>}
              {event.meetingPoint && <Typography variant="body2" sx={{ mt: 1 }}><strong>Meeting:</strong> {event.meetingPoint}</Typography>}
              {event.returnDetails && <Typography variant="body2"><strong>Return:</strong> {event.returnDetails}</Typography>}
              <Button
                component={Link}
                to={`/event-consent/${event.token}`}
                state={{ fromParentPortal: true }}
                variant="contained"
                color="success"
                sx={{ mt: 2 }}
              >
                Complete Event Consent
              </Button>
            </Paper>
          ))}
        </Box>
        {visible.length === 0 && (
          <OperationalEmptyState>No event consent requests match that search.</OperationalEmptyState>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={4}>
      {eventConsentContent}
      <Box id="parent-event-galleries" sx={{ scrollMarginTop: 24 }}>
        <Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Event Galleries</Typography>
        <ParentEventGallerySection sections={sections} />
      </Box>
    </Stack>
  );
}
