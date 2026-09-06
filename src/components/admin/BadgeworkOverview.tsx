import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography, Chip } from "@mui/material";
import { useState } from "react";

import BadgeworkAwaitingAwardQueue from "./BadgeworkAwaitingAwardQueue.tsx";
import BadgeworkMemberProgress from "./BadgeworkMemberProgress.tsx";
import { useAdminAuth } from "./AdminAuthProvider.tsx";
import { adventureSkills } from "../../data/adventureSkills/index.ts";
import { recordAuditEvent } from "../../services/auditLog.ts";
import type { MemberRecord } from "../../services/memberAdmin.ts";
import { setStageAwardForMembers, type MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import { adventureSkillOverview, type AdventureStageOverviewStatus } from "../../services/adventureSkillOverviewLogic.ts";
import { badgeworkProgressFilterCounts, matchesBadgeworkProgressFilter, type BadgeworkProgressFilter } from "../../services/adventureSkillOverviewFilterLogic.ts";
import { badgeworkAwardCandidates, groupAwardCandidates } from "../../services/adventureSkillAwardQueueLogic.ts";
import { adventureSkillProgressCsv, badgeworkExportFilename } from "../../services/adventureSkillProgressCsv.ts";
import { assertOperationalExportAllowed } from "../../services/exportGovernance.ts";

type Props = {
  activeMemberCount: number;
  error: string;
  loaded: boolean;
  loading: boolean;
  members: MemberRecord[];
  onOpenMemberSkill: (memberId: string, skillId: string, stage: number) => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onSectionChange: (value: string) => void;
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>;
  search: string;
  section: string;
  sections: string[];
};

const statusLabel = (status: AdventureStageOverviewStatus) => status === "requirements-complete" ? "Awaiting award" : status === "in-progress" ? "In progress" : status === "awarded" ? "Awarded" : "Not started";

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function BadgeworkOverview({ activeMemberCount, error, loaded, loading, members, onOpenMemberSkill, onRetry, onSearchChange, onSectionChange, progressByMemberId, search, section, sections }: Props) {
  const { adminProfile } = useAdminAuth();
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [skillFilter, setSkillFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState<BadgeworkProgressFilter>("all");
  const [awarding, setAwarding] = useState(false);
  const [awardMessage, setAwardMessage] = useState("");
  const [awardError, setAwardError] = useState("");
  const selectedMember = members.find((member) => member.id === selectedMemberId);
  if (selectedMember) {
    return <BadgeworkMemberProgress member={selectedMember} onBack={() => setSelectedMemberId("")} onOpenStage={onOpenMemberSkill} progress={progressByMemberId.get(selectedMember.id) ?? { memberId: selectedMember.id, requirements: [], awards: [] }} />;
  }

  return <Stack spacing={2} data-testid="badgework-overview">
    <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 2.5 }}><Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Badgework Overview</Typography><Typography color="text.secondary">Scan each child’s Adventure Skills progress, then open the exact skill and stage that needs attention.</Typography></Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr repeat(3, 1fr)" }, gap: 2 }}>
        <TextField label="Search children" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Name or section" />
        <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={section} onChange={(event) => onSectionChange(event.target.value)}>{sections.map((item) => <MenuItem key={item} value={item}>{item === "all" ? "All sections" : item}</MenuItem>)}</Select></FormControl>
        <FormControl><InputLabel id="badgework-skill-filter-label">Adventure Skill</InputLabel><Select id="badgework-skill-filter" labelId="badgework-skill-filter-label" label="Adventure Skill" value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)}><MenuItem value="all">All skills</MenuItem>{adventureSkills.map((skill) => <MenuItem key={skill.id} value={skill.id}>{skill.name}</MenuItem>)}</Select></FormControl>
        <FormControl><InputLabel id="badgework-progress-filter-label">Progress</InputLabel><Select id="badgework-progress-filter" labelId="badgework-progress-filter-label" label="Progress" value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as BadgeworkProgressFilter)}><MenuItem value="all">All progress</MenuItem><MenuItem value="awaiting-award">Awaiting award</MenuItem><MenuItem value="in-progress">In progress</MenuItem><MenuItem value="awarded">Awarded</MenuItem><MenuItem value="not-started">Not started</MenuItem></Select></FormControl>
      </Box>
    </Paper>

    {awardMessage && <Alert severity="success">{awardMessage}</Alert>}
    {awardError && <Alert severity="error">{awardError}</Alert>}
    {loading && <Paper variant="outlined" sx={{ minHeight: 220, display: "grid", placeItems: "center" }}><Stack spacing={1.5} sx={{ alignItems: "center" }}><CircularProgress /><Typography color="text.secondary">Loading Badgework Overview…</Typography></Stack></Paper>}
    {error && <Alert severity="error" action={<Button color="inherit" onClick={onRetry}>Retry</Button>}>{error}</Alert>}
    {!loading && !error && loaded && (() => {
      const counts = badgeworkProgressFilterCounts(members.map((member) => member.id), progressByMemberId, skillFilter);
      const filteredMembers = members.filter((member) => matchesBadgeworkProgressFilter(progressByMemberId.get(member.id) ?? { memberId: member.id, requirements: [], awards: [] }, skillFilter, progressFilter));
      const queueCandidates = badgeworkAwardCandidates(filteredMembers, progressByMemberId).filter((candidate) => skillFilter === "all" || candidate.skillId === skillFilter);
      const exportProgress = () => {
        const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
        assertOperationalExportAllowed("badgework-progress", { isAdmin, sections: adminProfile?.sections ?? [] });
        downloadCsv(badgeworkExportFilename(skillFilter), adventureSkillProgressCsv(filteredMembers, progressByMemberId, skillFilter));
        void recordAuditEvent({ category: "member", action: "badgework-progress-exported", targetId: skillFilter, targetLabel: "Badgework progress", description: `Exported filtered badgework progress for ${filteredMembers.length} children.`, section: section === "all" ? "All permitted sections" : section });
      };
      const awardAllReady = async () => {
        if (queueCandidates.length === 0) return;
        setAwarding(true); setAwardError(""); setAwardMessage("");
        try {
          await Promise.all(groupAwardCandidates(queueCandidates).map((group) => setStageAwardForMembers(group.memberIds, group.skillId, group.stage, true)));
          setAwardMessage(`${queueCandidates.length} ready badge ${queueCandidates.length === 1 ? "award was" : "awards were"} recorded.`);
          onRetry();
        } catch (queueError) {
          console.error("Unable to award ready badgework:", queueError);
          setAwardError("Unable to award all ready badgework. No competency progress was changed; review the remaining queue and try again.");
          throw queueError;
        } finally { setAwarding(false); }
      };
      return <>
      <Paper variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Typography variant="body2" sx={{ fontWeight: 800, mr: .5 }}>Quick filters</Typography>
        <Button size="small" variant={progressFilter === "all" ? "contained" : "outlined"} onClick={() => setProgressFilter("all")}>All shown · {counts.all}</Button>
        <Button size="small" color="warning" variant={progressFilter === "awaiting-award" ? "contained" : "outlined"} onClick={() => setProgressFilter("awaiting-award")}>Awaiting award · {counts["awaiting-award"]}</Button>
        <Button size="small" color="info" variant={progressFilter === "in-progress" ? "contained" : "outlined"} onClick={() => setProgressFilter("in-progress")}>In progress · {counts["in-progress"]}</Button>
        <Button size="small" color="success" variant="contained" disabled={filteredMembers.length === 0} onClick={exportProgress} sx={{ ml: { sm: "auto" } }}>Export filtered CSV</Button>
      </Stack></Paper>
      {progressFilter === "awaiting-award" && <BadgeworkAwaitingAwardQueue candidates={queueCandidates} awarding={awarding} onAwardAll={awardAllReady} onOpenStage={onOpenMemberSkill} />}
      {filteredMembers.map((member) => {
      const progress = progressByMemberId.get(member.id) ?? { memberId: member.id, requirements: [], awards: [] };
      const summaries = adventureSkillOverview(progress);
      const awaitingAward = summaries.filter((summary) => summary.status === "requirements-complete").length;
      const inProgress = summaries.filter((summary) => summary.status === "in-progress").length;
      return <Paper key={member.id} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }} data-testid={`badgework-overview-member-${member.id}`}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 1.5 }}>
          <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>{member.displayName}</Typography><Typography variant="body2" color="text.secondary">{member.section}</Typography></Box>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
            {inProgress > 0 && <Chip size="small" color="info" label={`${inProgress} in progress`} />}
            {awaitingAward > 0 && <Chip size="small" color="warning" label={`${awaitingAward} awaiting award`} />}
            <Button size="small" variant="outlined" onClick={() => setSelectedMemberId(member.id)}>View child progress</Button>
          </Stack>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(5,minmax(0,1fr))" }, gap: 1 }}>
          {summaries.map((summary) => {
            const activeStage = summary.stages.find((item) => item.stage === summary.nextStage)!;
            const detail = summary.status === "awarded"
              ? `Stage ${summary.highestAwardedStage} awarded`
              : summary.status === "requirements-complete"
                ? `Stage ${activeStage.stage} awaiting award`
                : summary.status === "in-progress"
                  ? `Stage ${activeStage.stage} · ${activeStage.completedRequirements}/${activeStage.totalRequirements}`
                  : summary.highestAwardedStage > 0
                    ? `Stage ${summary.highestAwardedStage} awarded · Stage ${activeStage.stage} next`
                    : "Not started";
            return <Button key={summary.skillId} variant="outlined" color={summary.status === "requirements-complete" ? "warning" : summary.status === "awarded" ? "success" : summary.status === "in-progress" ? "info" : "inherit"} onClick={() => onOpenMemberSkill(member.id, summary.skillId, summary.nextStage)} sx={{ display: "block", textAlign: "left", p: 1.25, minWidth: 0, textTransform: "none" }} aria-label={`${member.displayName} · ${summary.skillName} · ${statusLabel(summary.status)}`}>
              <Typography sx={{ fontWeight: 800, fontSize: ".86rem", overflow: "hidden", textOverflow: "ellipsis" }}>{summary.skillName}</Typography>
              <Typography variant="caption" sx={{ display: "block" }}>{detail}</Typography>
            </Button>;
          })}
        </Box>
      </Paper>;
      })}
      {filteredMembers.length === 0 && <Alert severity="info">No children match the current badgework filters.</Alert>}
      </>;
    })()}
    {!loading && !error && activeMemberCount === 0 && <Alert severity="info">There are no active children to show.</Alert>}
  </Stack>;
}
