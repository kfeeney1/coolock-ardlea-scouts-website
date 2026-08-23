import { Alert, Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { getPublicWhosWho, type PublicWhosWhoLeader } from "../services/publicWhosWho";

const SECTION_ORDER = ["Group", "Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];

export default function PublicWhosWho() {
  const [leaders, setLeaders] = useState<PublicWhosWhoLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPublicWhosWho()
      .then((result) => {
        if (!cancelled) {
          setLeaders(result);
          setError(false);
        }
      })
      .catch((reason) => {
        console.error("Unable to load public Who's Who:", reason);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const sections = useMemo(() => {
    const values = [...new Set(leaders.map((leader) => leader.organisationSection))];
    return values.sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a);
      const bi = SECTION_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });
  }, [leaders]);

  if (loading) {
    return <Box sx={{ minHeight: 220, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box>;
  }
  if (error) {
    return <Alert severity="error">Unable to load Who’s Who right now.</Alert>;
  }
  if (leaders.length === 0) {
    return <Alert severity="info">No leaders are currently listed in the public Who’s Who.</Alert>;
  }

  return <Stack spacing={3} data-testid="public-whos-who">
    {sections.map((section) => (
      <Paper key={section} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderTop: "5px solid", borderTopColor: section === "Group" ? "secondary.main" : "success.main" }}>
        <Typography variant="h4" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>
          {section === "Group" ? "Group Leadership" : section}
        </Typography>
        <Stack spacing={1.5}>
          {leaders.filter((leader) => leader.organisationSection === section).map((leader) => (
            <Paper key={leader.uid} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{leader.displayName}</Typography>
              <Typography color="secondary.main" sx={{ fontWeight: 700 }}>{leader.scoutingRole}</Typography>
            </Paper>
          ))}
        </Stack>
      </Paper>
    ))}
  </Stack>;
}
