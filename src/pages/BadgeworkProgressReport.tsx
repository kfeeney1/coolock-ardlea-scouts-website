import { Alert, Button, CircularProgress, Container, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { adventureSkills } from "../data/adventureSkills";
import { badgeworkReportAccess } from "../security/badgeworkReportAccess";
import { applicationErrorMessage } from "../services/applicationErrors";
import { adventureSkillOverview } from "../services/adventureSkillOverviewLogic";
import { loadMemberAdventureProgressForMembers, type MemberAdventureProgress } from "../services/adventureSkillProgress";
import { downloadBadgeworkProgressCsv } from "../services/adventureSkillProgressCsv";
import { recordAuditEvent } from "../services/auditLog";
import { loadMembers, type MemberRecord } from "../services/memberAdmin";
import { sectionFilterOptions } from "../services/sectionOrder";

export default function BadgeworkProgressReport() {
  const { adminProfile, user } = useAdminAuth();
  const access = useMemo(() => badgeworkReportAccess(adminProfile), [adminProfile]);
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Badgework Progress" />
    {access.canOpen ? <ProgressReport key={JSON.stringify([user?.uid, access])} access={access} />
      : <Alert severity="error">You do not have access to this report.</Alert>}
  </Container>;
}

function ProgressReport({ access }: { access: ReturnType<typeof badgeworkReportAccess> }) {
  const [data, setData] = useState<{ members: MemberRecord[]; progress: Map<string, MemberAdventureProgress> }>();
  const [error, setError] = useState("");
  const [section, setSection] = useState("all");
  const [skill, setSkill] = useState(adventureSkills[0]?.id ?? "");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const records = await loadMembers({ group: access.group, sections: access.exportSections });
        const members = records.filter(member => member.status === "active" && (access.group || access.exportSections.includes(member.section)));
        if (controller.signal.aborted) return;
        const progress = await loadMemberAdventureProgressForMembers(members.map(member => member.id), { signal: controller.signal });
        if (!controller.signal.aborted) setData({ members, progress: new Map(progress.map(row => [row.memberId, row])) });
      } catch (failure) {
        if (!controller.signal.aborted) setError(applicationErrorMessage(failure, "Unable to load badgework progress.", "BadgeworkProgressReport"));
      }
    })();
    return () => controller.abort();
  }, [access]);
  const scope = access.group ? "All sections" : access.exportSections.join(", ");
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <CircularProgress aria-label="Loading badgework progress" />;
  const members = data.members.filter(member => section === "all" || member.section === section);
  const exportMembers = members.filter(member => access.exportSections.includes(member.section));
  const sections = sectionFilterOptions(access.group ? data.members.map(member => member.section) : access.exportSections);
  function exportProgress() {
    if (!data || !exportMembers.length) return;
    downloadBadgeworkProgressCsv(exportMembers, data.progress, skill);
    void recordAuditEvent({ category: "member", action: "badgework-progress-exported", targetId: skill, targetLabel: "Badgework progress", description: `Exported badgework progress for ${exportMembers.length} children.`, section: access.exportSections.join(", ") });
  }
  return <Stack spacing={2}>
    <Typography>Scope: {scope}</Typography>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField select fullWidth label="Section" value={section} onChange={event => setSection(event.target.value)}>
        <MenuItem value="all">All permitted sections</MenuItem>
        {sections.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
      </TextField>
      <TextField select fullWidth label="Adventure Skill" value={skill} onChange={event => setSkill(event.target.value)}>
        {adventureSkills.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
      </TextField>
    </Stack>
    {access.exportSections.length > 0 && <Button variant="outlined" disabled={!exportMembers.length} onClick={exportProgress}>Export filtered CSV</Button>}
    {members.length === 0 ? <Typography role="status">No active children match this section.</Typography> :
      members.map(member => {
        const progress = data.progress.get(member.id);
        const summary = progress && adventureSkillOverview(progress).find(item => item.skillId === skill);
        if (!summary) return null;
        const stage = summary.stages.find(item => item.stage === summary.nextStage);
        return <Paper key={member.id} variant="outlined" sx={{ p: 2 }}>
          <Typography component="h2" variant="h6">{member.displayName}</Typography>
          <Typography>{member.section} · Highest award: {summary.highestAwardedStage || "None"}</Typography>
          {stage && <Typography>Stage {stage.stage} · {stage.completedRequirements}/{stage.totalRequirements} competencies</Typography>}
        </Paper>;
      })}
  </Stack>;
}
