import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { SectionIdentityChip, sectionCardSx } from "./SectionIdentityControls";
import { getPublicWhosWho, type PublicWhosWhoLeader } from "../services/publicWhosWho";
import { publicLeadersForSection, publicSectionTestId, publicWhosWhoSections } from "../services/publicWhosWhoLayout";
import { sectionVisualTokens } from "../theme/sectionColours";

const OFFICIAL_SECTION_SYMBOL_POSITION: Readonly<Record<string, string>> = {
  Beavers: "0% 50%",
  Cubs: "25% 50%",
  Scouts: "50% 50%",
  Ventures: "75% 50%",
  Rovers: "100% 50%"
};

function WhosWhoSectionIcon({ section, sectionId }: { section: string; sectionId: string }) {
  const spritePosition = OFFICIAL_SECTION_SYMBOL_POSITION[section];

  if (spritePosition) {
    return (
      <Box
        component="span"
        aria-hidden="true"
        data-testid={`whos-who-section-icon-${sectionId}`}
        data-icon-id={`official-one-programme-${sectionId}`}
        sx={{
          display: "inline-block",
          width: 38,
          height: 36,
          flex: "0 0 auto",
          backgroundImage: "url('/scouting-ireland-one-programme-sections.webp')",
          backgroundRepeat: "no-repeat",
          backgroundSize: "500% 100%",
          backgroundPosition: spritePosition,
          borderRadius: 0.75
        }}
      />
    );
  }

  return (
    <Box
      component="span"
      aria-hidden="true"
      data-testid={`whos-who-section-icon-${sectionId}`}
      data-icon-id="neutral-group"
      sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 36, flex: "0 0 auto" }}
    >
      <GroupsRoundedIcon fontSize="medium" />
    </Box>
  );
}

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
      const tokens = sectionVisualTokens(section);

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
          data-section={tokens.section ?? "group"}
          variant="outlined"
          sx={{ minWidth: 0, overflow: "hidden", borderColor: tokens.border }}
        >
          <Button
            id={toggleId}
            type="button"
            fullWidth
            aria-expanded={expanded}
            aria-controls={panelId}
            data-testid={`whos-who-toggle-${sectionId}`}
            data-section={tokens.section ?? "group"}
            onClick={toggleSection}
            sx={{
              px: { xs: 2, md: 3 },
              py: 1.5,
              minWidth: 0,
              justifyContent: "space-between",
              gap: 1.5,
              textAlign: "left",
              textTransform: "none",
              color: "text.primary",
              backgroundColor: expanded ? tokens.hoverBackground : tokens.subtleBackground,
              borderLeft: `4px solid ${tokens.accent}`,
              borderRadius: 0,
              transition: "background-color 150ms ease",
              "&:hover": { backgroundColor: tokens.hoverBackground },
              "&.Mui-focusVisible": {
                outline: `3px solid ${tokens.focusRing}`,
                outlineOffset: "-3px",
                backgroundColor: tokens.hoverBackground
              }
            }}
          >
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0 }}>
              <WhosWhoSectionIcon section={section} sectionId={sectionId} />
              <Typography component="span" variant="h4" sx={{ fontWeight: 800, minWidth: 0, overflowWrap: "anywhere", color: tokens.foreground }}>
                {label}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }} aria-hidden="true">
              <Box sx={{ display: { xs: "none", sm: "block" } }}><SectionIdentityChip section={section} /></Box>
              <Typography
                component="span"
                sx={{
                  fontSize: "1.5rem",
                  lineHeight: 1,
                  color: tokens.foreground,
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
                pb: { xs: 2, md: 3 },
                pt: 1.5
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
