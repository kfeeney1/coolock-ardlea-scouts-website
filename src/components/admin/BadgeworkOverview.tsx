import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography, Chip } from "@mui/material";
import { useState } from "react";

import BadgeworkAwaitingAwardQueue from "./BadgeworkAwaitingAwardQueue.tsx";
import BadgeworkMemberProgress from "./BadgeworkMemberProgress.tsx";
import BadgeworkSkillGrid from "./BadgeworkSkillGrid.tsx";
import { useAdminAuth } from "./AdminAuthProvider.tsx";
import { adventureSkills } from "../../data/adventureSkills/index.ts";
import { recordAuditEvent } from "../../services/auditLog.ts";
import type { MemberRecord } from "../../services/memberAdmin.ts";
import { setStageAwardForMembers, type MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import { adventureSkillOverview } from "../../services/adventureSkillOverviewLogic.ts";
import { badgeworkProgressFilterCounts, matchesBadgeworkLevelFilter, matchesBadgeworkLevelNumber, matchesBadgeworkProgressFilter, type BadgeworkExactLevelFilter, type BadgeworkLevelFilter, type BadgeworkProgressFilter } from "../../services/adventureSkillOverviewFilterLogic.ts";
import { badgeworkAwardCandidates, groupAwardCandidates, type BadgeworkAwardCandidate } from "../../services/adventureSkillAwardQueueLogic.ts";
import { adventureSkillProgressCsv, badgeworkExportFilename } from "../../services/adventureSkillProgressCsv.ts";
import { adventureSkillColour } from "../../services/adventureSkillPresentation.ts";
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

function skillOption(skillId: string, name: string) {
  return <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
    <Box aria-hidden="true" sx={{ width: 18, height: 18, borderRadius: .75, flex: "0 0 auto", backgroundColor: adventureSkillColour(skillId), border: "1px solid", borderColor: "rgba(0,0,0,.16)" }} />
    <Typography component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{name}</Typography>
  </Stack>;
}

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
  const [levelFilter, setLevelFilter] = useState<BadgeworkLevelFilter>("all");
  const [exactLevelFilter, setExactLevelFilter] = useState<BadgeworkExactLevelFilter>("all");
  const [attentionFilter, setAttentionFilter] = useState<BadgeworkProgressFilter>("all");
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
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", lg: "2fr repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <TextField label="Search children" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Name or section" />
        <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={section} onChange={(event) => onSectionChange(event.target.value)}>{sections.map((item) => <MenuItem key={item} value={item}>{item === "all" ? "All sections" : item}</MenuItem>)}</Select></FormControl>
        <FormControl><InputLabel id="badgework-skill-filter-label">Adventure Skill</InputLabel><Select id="badgework-skill-filter" labelId="badgework-skill-filter-label" label="Adventure Skill" value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)} renderValue={(value) => value === "all" ? "All skills" : (() => { const selectedSkill = adventureSkills.find((skill) => skill.id === value); return selectedSkill ? skillOption(selectedSkill.id, selectedSkill.name) : "All skills"; })()}><MenuItem value="all">All skills</MenuItem>{adventureSkills.map((skill) => <MenuItem key={skill.id} value={skill.id}>{skillOption(skill.id, skill.name)}</MenuItem>)}</Select></FormControl>
        <FormControl><InputLabel id="badgework-level-filter-label">Level Achieved</InputLabel><Select id="badgework-level-filter" labelId="badgework-level-filter-label" label="Level Achieved" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as BadgeworkLevelFilter)}><MenuItem value="all">All levels</MenuItem><MenuItem value="1">Level 1</MenuItem><MenuItem value="2">Level 2</MenuItem><MenuItem value="3">Level 3</MenuItem><MenuItem value="4">Level 4</MenuItem><MenuItem value="5">Level 5</MenuItem><MenuItem value="6-plus">Level 6+</MenuItem></Select></FormControl>
        <FormControl><InputLabel id="badgework-exact-level-filter-label">Level to inspect</InputLabel><Select id="badgework-exact-level-filter" labelId="badgework-exact-level-filter-label" label="Level to inspect" value={exactLevelFilter} onChange={(event) => setExactLevelFilter(event.target.value as BadgeworkExactLevelFilter)}><MenuItem value="all">Any level</MenuItem>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => <MenuItem key={level} value={String(level)}>Level {level}</MenuItem>)}</Select></FormControl>
      </Box>
    </Paper>

    {awardMessage && <Alert severity="success">{awardMessage}</Alert>}
    {awardError && <Alert severity="error">{awardError}</Alert>}
    {loading && <Paper variant="outlined" sx={{ minHeight: 220, display: "grid", placeItems: "center" }}><Stack spacing={1.5} sx={{ alignItems: "center" }}><CircularProgress /><Typography color="text.secondary">Loading Badgework Overview…</Typography></Stack></Paper>}
    {error && <Alert severity="error" action={<Button color="inherit" onClick={onRetry}>Retry</Button>}>{error}</Alert>}
    {!loading && !error && loaded && (() => {
      const levelFilteredMembers = members.filter((member) => matchesBadgeworkLevelFilter(progressByMemberId.get(member.id) ?? { memberId: member.id, requirements: [], awards: [] }, skillFilter, levelFilter));
      const counts = badgeworkProgressFilterCounts(levelFilteredMembers.map((member) => member.id), progressByMemberId, skillFilter, exactLevelFilter);
      const filteredMembers = levelFilteredMembers.filter((member) => matchesBadgeworkProgressFilter(progressByMemberId.get(member.id) ?? { memberId: member.id, requirements: [], awards: [] }, skillFilter, attentionFilter, exactLevelFilter));
      const queueCandidates = badgeworkAwardCandidates(filteredMembers, progressByMemberId).filter((candidate) => (skillFilter === "all" || candidate.skillId === skillFilter) && matchesBadgeworkLevelNumber(candidate.stage, levelFilter) && (exactLevelFilter === "all" || candidate.stage === Number(exactLevelFilter)));
      const exportProgress = () => {
        const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
        assertOperationalExportAllowed("badgework-progress", { isAdmin, sections: adminProfile?.sections ?? [] });
        downloadCsv(badgeworkExportFilename(skillFilter), adventureSkillProgressCsv(filteredMembers, progressByMemberId, skillFilter));
        void recordAuditEvent({ category: "member", action: "badgework-progress-exported", targetId: skillFilter, targetLabel: "Badgework progress", description: `Exported filtered badgework progress for ${filteredMembers.length} children.`, section: section === "all" ? "All permitted sections" : section });
      };
      const awardSelectedReady = async (selectedCandidates: readonly BadgeworkAwardCandidate[]) => {
        if (selectedCandidates.length === 0) return;
        setAwarding(true); setAwardError(""); setAwardMessage("");
        try {
          await Promise.all(groupAwardCandidates(selectedCandidates).map((group) => setStageAwardForMembers(group.memberIds, group.skillId, group.stage, true)));
          setAwardMessage(`${selectedCandidates.length} ready badge ${selectedCandidates.length === 1 ? "award was" : "awards were"} recorded.`);
          onRetry();
        } catch (queueError) {
          console.error("Unable to award selected badgework:", queueError);
          setAwardError("Unable to award the selected ready badgework. No competency progress was changed; review the remaining queue and try again.");
          throw queueError;
        } finally { setAwarding(false); }
      };
      return <>
      <Paper variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Typography variant="body2" sx={{ fontWeight: 800, mr: .5 }}>Quick filters</Typography>
        <Button size="small" variant={attentionFilter === "all" ? "contained" : "outlined"} onClick={() => setAttentionFilter("all")}>All shown · {counts.all}</Button>
        <Button size="small" variant={attentionFilter === "not-started" ? "contained" : "outlined"} onClick={() => setAttentionFilter("not-started")}>Not started · {counts["not-started"]}</Button>
        <Button size="small" color="info" variant={attentionFilter === "in-progress" ? "contained" : "outlined"} onClick={() => setAttentionFilter("in-progress")}>Started · {counts["in-progress"]}</Button>
        <Button size="small" color="warning" variant={attentionFilter === "awaiting-award" ? "contained" : "outlined"} onClick={() => setAttentionFilter("awaiting-award")}>Awaiting award · {counts["awaiting-award"]}</Button>
        <Button size="small" color="success" variant={attentionFilter === "awarded" ? "contained" : "outlined"} onClick={() => setAttentionFilter("awarded")}>Awarded · {counts.awarded}</Button>
        <Button size="small" color="success" variant="contained" disabled={filteredMembers.length === 0} onClick={exportProgress} sx={{ ml: { sm: "auto" } }}>Export filtered CSV</Button>
      </Stack></Paper>
      {attentionFilter === "awaiting-award" && <BadgeworkAwaitingAwardQueue candidates={queueCandidates} awarding={awarding} onAwardSelected={awardSelectedReady} onOpenStage={onOpenMemberSkill} />}
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
        <BadgeworkSkillGrid memberName={member.displayName} summaries={summaries} onOpenStage={(nextSkillId, nextStage) => onOpenMemberSkill(member.id, nextSkillId, nextStage)} />
      </Paper>;
      })}
      {filteredMembers.length === 0 && <Alert severity="info">No children match the current badgework filters.</Alert>}
      </>;
    })()}
    {!loading && !error && activeMemberCount === 0 && <Alert severity="info">There are no active children to show.</Alert>}
  </Stack>;
}
