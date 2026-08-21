import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadAdminOverview, type AdminOverview } from "../../services/adminOverview";
import { useAdminAuth } from "./AdminAuthProvider";

const emptyOverview: AdminOverview = {
  pendingParents: 0,
  pendingLeaders: 0,
  activeMembers: 0,
  outstandingConsent: 0,
  membersBySection: [],
  upcomingEvents: []
};

export default function AdminOverviewPanel() {
  const { adminProfile } = useAdminAuth();
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";

  const refresh = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      setOverview(await loadAdminOverview());
    } catch (overviewError) {
      console.error("Unable to load admin overview:", overviewError);
      setError("Unable to load the administration overview right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <Box sx={{ mb: 3 }} data-testid="admin-overview">
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          gap: 2,
          mb: 2
        }}
      >
        <Box>
          <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>
            Administration Overview
          </Typography>
          <Typography color="text.secondary">
            What needs attention across parents, leaders, members, events and consent.
          </Typography>
        </Box>
        <Button variant="outlined" color="secondary" onClick={() => void refresh()}>
          Refresh Overview
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Paper variant="outlined" sx={{ minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress color="secondary" />
        </Paper>
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" },
              gap: 2,
              mb: 2
            }}
          >
            {[
              ["Pending Parent Requests", overview.pendingParents, "/leader/parent-access"],
              ["Pending Leader Requests", overview.pendingLeaders, "/leader/requests"],
              ["Active Members", overview.activeMembers, "/leader/members"],
              ["Outstanding Event Consent", overview.outstandingConsent, "/leader/event-consent"]
            ].map(([label, value, path]) => (
              <Paper key={String(label)} variant="outlined" sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="h3" color="secondary" sx={{ fontWeight: 800 }}>
                  {value}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
                <Button component={Link} to={String(path)} size="small" sx={{ alignSelf: "flex-start", px: 0 }}>
                  Open
                </Button>
              </Paper>
            ))}
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.5fr" }, gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="h6" color="secondary" sx={{ fontWeight: 800, mb: 1.5 }}>
                Members by Section
              </Typography>
              {overview.membersBySection.length === 0 ? (
                <Typography color="text.secondary">No active members found.</Typography>
              ) : (
                <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                  {overview.membersBySection.map((item) => (
                    <Chip key={item.section} label={`${item.section}: ${item.count}`} variant="outlined" />
                  ))}
                </Stack>
              )}
              <Button component={Link} to="/leader/members" sx={{ mt: 2, px: 0 }}>
                Manage Members
              </Button>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 1.5 }}>
                <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>
                  Upcoming Events
                </Typography>
                <Button component={Link} to="/leader/events" size="small">View All</Button>
              </Box>
              {overview.upcomingEvents.length === 0 ? (
                <Typography color="text.secondary">No upcoming open or draft events.</Typography>
              ) : (
                <Stack spacing={1.25}>
                  {overview.upcomingEvents.slice(0, 5).map((event) => (
                    <Box key={event.id} sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 1, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>{event.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {event.startDate || "Date not set"} · {event.section} · {event.status}
                        </Typography>
                      </Box>
                      {event.consentRequired && (
                        <Chip
                          size="small"
                          color={event.outstandingConsent > 0 ? "warning" : "success"}
                          label={event.outstandingConsent > 0 ? `${event.outstandingConsent} consent outstanding` : "Consent complete"}
                        />
                      )}
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Box>
        </>
      )}
    </Box>
  );
}
