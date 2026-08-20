import { Alert, Box, Chip, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { loadUpcomingPublicActivities } from "../services/publicActivities";
import type { PublicActivity } from "../services/publicActivities";

function formatDate(value: string): string {
  if (!value) return "Date to be confirmed";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IE", { dateStyle: "long" }).format(date);
}

export default function Activities() {
  const [activities, setActivities] = useState<PublicActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setActivities(await loadUpcomingPublicActivities());
      } catch (loadError) {
        console.error("Unable to load public activities:", loadError);
        setError("Unable to load upcoming activities at the moment.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Box sx={{ minHeight: "70vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography variant="h3" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>
          Upcoming Activities
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          Upcoming camps, trips, meetings and activities from across the Scout Group.
        </Typography>

        {loading && (
          <Box sx={{ minHeight: 220, display: "grid", placeItems: "center" }}>
            <CircularProgress color="success" />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && activities.length === 0 && (
          <Alert severity="info">There are no published upcoming activities at the moment.</Alert>
        )}

        {!loading && !error && (
          <Stack spacing={2.5}>
            {activities.map((activity) => (
              <Paper key={activity.id} variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderLeft: "5px solid", borderLeftColor: "secondary.main" }}>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, mb: 1 }}>
                  <Chip label={activity.section} color="secondary" size="small" />
                  <Chip label={activity.eventType} variant="outlined" size="small" />
                </Stack>

                <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>
                  {activity.title}
                </Typography>

                <Typography sx={{ mt: 1, fontWeight: 700 }}>
                  {formatDate(activity.startDate)}
                  {activity.endDate && activity.endDate !== activity.startDate
                    ? ` – ${formatDate(activity.endDate)}`
                    : ""}
                </Typography>

                {activity.location && (
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {activity.location}
                  </Typography>
                )}

                {activity.description && (
                  <Typography sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}>
                    {activity.description}
                  </Typography>
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
