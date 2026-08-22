import { Alert, Box, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { loadInternalOrganisation, loadPublicOrganisation } from "../services/organisationChart";
import type { OrganisationLeader } from "../services/organisationChart";

const SECTION_ORDER = ["Group", "Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];

function depthFor(leader: OrganisationLeader, byId: Map<string, OrganisationLeader>): number {
  let depth = 0;
  let current = leader;
  const seen = new Set<string>([leader.uid]);
  while (current.reportsToUid && byId.has(current.reportsToUid) && depth < 5) {
    if (seen.has(current.reportsToUid)) break;
    seen.add(current.reportsToUid);
    current = byId.get(current.reportsToUid)!;
    depth += 1;
  }
  return depth;
}

export default function OrganisationChart({ publicView = false, embedded = false }: { publicView?: boolean; embedded?: boolean }) {
  const [leaders, setLeaders] = useState<OrganisationLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = publicView ? await loadPublicOrganisation() : await loadInternalOrganisation();
        if (!cancelled) {
          setLeaders(result);
          setError("");
        }
      } catch (e) {
        console.error("Unable to load organisation chart:", e);
        if (!cancelled) setError("Unable to load the organisation chart.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [publicView]);

  const byId = useMemo(() => new Map(leaders.map((leader) => [leader.uid, leader])), [leaders]);
  const sections = useMemo(() => {
    const present = [...new Set(leaders.map((leader) => leader.organisationSection || "Group"))];
    return present.sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a); const bi = SECTION_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });
  }, [leaders]);

  const content = <>
    {loading ? <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box>
      : error ? <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        : leaders.length === 0 ? <Alert severity="info">No leaders have been added to the organisational chart yet.</Alert>
          : <Stack spacing={3}>
      {sections.map((section) => {
        const sectionLeaders = leaders.filter((leader) => leader.organisationSection === section).sort((a, b) => a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));
        return <Paper key={section} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderTop: "5px solid", borderTopColor: section === "Group" ? "secondary.main" : "success.main" }}>
          <Typography variant="h4" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>{section === "Group" ? "Group Leadership" : section}</Typography>
          <Stack spacing={1.5}>
            {sectionLeaders.map((leader) => {
              const manager = leader.reportsToUid ? byId.get(leader.reportsToUid) : undefined;
              const depth = depthFor(leader, byId);
              return <Paper key={leader.uid} elevation={depth === 0 ? 2 : 0} variant={depth === 0 ? "elevation" : "outlined"} sx={{ p: 2, ml: { xs: Math.min(depth, 2) * 1.5, md: depth * 4 }, borderLeft: depth > 0 ? "4px solid" : undefined, borderLeftColor: depth > 0 ? "divider" : undefined }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{leader.displayName}</Typography>
                <Typography color="secondary.main" sx={{ fontWeight: 700 }}>{leader.scoutingRole || "Leader"}</Typography>
                {manager && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Reports to {manager.displayName} · {manager.scoutingRole}</Typography>}
              </Paper>;
            })}
          </Stack>
        </Paper>;
      })}
    </Stack>}
  </>;

  if (publicView && embedded) return content;

  if (publicView) {
    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}><Container maxWidth="lg">
      <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 }, mb: 3, textAlign: "center" }}>
        <Typography variant="h2" color="secondary" sx={{ fontWeight: 800 }}>Who’s Who</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>Meet the leaders who have chosen to be listed publicly and see how our Scout Group is organised.</Typography>
      </Paper>
      {content}
    </Container></Box>;
  }

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}><Container maxWidth="xl">
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Organisational Chart" description="Internal Who’s Who showing the scouting hierarchy, sections and reporting relationships for active leaders." />
    {content}
  </Container></Box>;
}
