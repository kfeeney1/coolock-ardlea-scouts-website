import { Alert, Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { SectionIdentityChip, sectionCardSx } from "./SectionIdentityControls";
import { getPublicWhosWho, type PublicWhosWhoLeader } from "../services/publicWhosWho";
import { publicLeadersForSection, publicSectionTestId, publicWhosWhoSections } from "../services/publicWhosWhoLayout";

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

  const sections = useMemo(() => publicWhosWhoSections(leaders), [leaders]);

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
    {sections.map((section) => {
      const sectionId = publicSectionTestId(section);
      const sectionLeaders = publicLeadersForSection(leaders, section);
      return (
        <Paper
          key={section}
          component="section"
          aria-labelledby={`whos-who-${sectionId}-heading`}
          data-testid={`whos-who-section-${sectionId}`}
          variant="outlined"
          sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", mb: 2 }}>
            <Typography id={`whos-who-${sectionId}-heading`} component="h3" variant="h4" color="secondary" sx={{ fontWeight: 800 }}>
              {section === "Group" ? "Group Leadership" : section}
            </Typography>
            <SectionIdentityChip section={section} />
          </Stack>
          <Box
            data-testid={`whos-who-grid-${sectionId}`}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
              gap: 1.5
            }}
          >
            {sectionLeaders.map((leader) => (
              <Paper
                key={`${section}:${leader.uid}`}
                component="article"
                variant="outlined"
                data-testid={`whos-who-leader-${sectionId}-${leader.uid}`}
                data-section={section}
                sx={[{ p: 2, minWidth: 0, overflowWrap: "anywhere" }, sectionCardSx(section)]}
              >
                <Typography component="h4" variant="h6" sx={{ fontWeight: 800 }}>{leader.displayName}</Typography>
                <Typography color="text.secondary" sx={{ mt: .5, fontWeight: 700 }}>{leader.scoutingRole}</Typography>
                <Box sx={{ mt: 1.5 }}><SectionIdentityChip section={section} /></Box>
              </Paper>
            ))}
          </Box>
        </Paper>
      );
    })}
  </Stack>;
}
