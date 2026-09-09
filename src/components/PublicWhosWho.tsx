import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { SectionIdentityChip, sectionCardSx } from "./SectionIdentityControls";
import { getPublicWhosWho, type PublicWhosWhoLeader } from "../services/publicWhosWho";
import { publicLeadersForSection, publicSectionTestId, publicWhosWhoSections } from "../services/publicWhosWhoLayout";

export default function PublicWhosWho() {
  const [leaders, setLeaders] = useState<PublicWhosWhoLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());

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

  return <Stack spacing={2} data-testid="public-whos-who">
    {sections.map((section) => {
      const sectionId = publicSectionTestId(section);
      const sectionLeaders = publicLeadersForSection(leaders, section);
      const expanded = expandedSections.has(section);
      const label = section === "Group" ? "Group Leadership" : section;
      const toggleId = `whos-who-${sectionId}-toggle`;
      const panelId = `whos-who-${sectionId}-panel`;

      const toggleSection = () => {
        setExpandedSections((current) => {
          const next = new Set(current);
          if (next.has(section)) next.delete(section);
          else next.add(section);
          return next;
        });
      };

      return (
        <Paper
          key={section}
          component="section"
          aria-labelledby={toggleId}
          data-testid={`whos-who-section-${sectionId}`}
          variant="outlined"
          sx={{ minWidth: 0, overflow: "hidden" }}
        >
          <Button
            id={toggleId}
            type="button"
            fullWidth
            aria-expanded={expanded}
            aria-controls={panelId}
            data-testid={`whos-who-toggle-${sectionId}`}
            onClick={toggleSection}
            sx={{
              px: { xs: 2, md: 3 },
              py: 2,
              minWidth: 0,
              justifyContent: "space-between",
              gap: 1.5,
              textAlign: "left",
              textTransform: "none",
              color: "text.primary",
              borderRadius: 0,
              "&.Mui-focusVisible": {
                outline: "3px solid",
                outlineColor: "primary.main",
                outlineOffset: "-3px"
              }
            }}
          >
            <Typography component="span" variant="h4" color="secondary" sx={{ fontWeight: 800, minWidth: 0, overflowWrap: "anywhere" }}>
              {label}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }} aria-hidden="true">
              <Box sx={{ display: { xs: "none", sm: "block" } }}><SectionIdentityChip section={section} /></Box>
              <Typography
                component="span"
                sx={{
                  fontSize: "1.5rem",
                  lineHeight: 1,
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 150ms ease"
                }}
              >
                ▾
              </Typography>
            </Stack>
          </Button>

          {expanded && (
            <Box
              id={panelId}
              role="region"
              aria-labelledby={toggleId}
              data-testid={`whos-who-grid-${sectionId}`}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
                gap: 1.5,
                px: { xs: 2, md: 3 },
                pb: { xs: 2, md: 3 }
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
          )}
        </Paper>
      );
    })}
  </Stack>;
}
