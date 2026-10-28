import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { adventureSkills, type AdventureSkill } from "../../data/adventureSkills/index.ts";
import type { MemberRecord } from "../../services/memberAdmin.ts";

type Props = { autoFocusSkill?: boolean; members: readonly MemberRecord[]; selectedCount: number; fromSource: boolean; skill?: AdventureSkill; saving: boolean;
  onChangeMembers: () => void; onChangeSkill: (value: string) => void; onCompleteStage: () => void;
  stageNavigation: ReactNode; selectedStageSummary: ReactNode; groupCompetencyControls: ReactNode; awardPanel: ReactNode; savePanel: ReactNode };

export default function BadgeworkRecordPanel({autoFocusSkill = false,members,selectedCount,fromSource,skill,saving,onChangeMembers,onChangeSkill,onCompleteStage,stageNavigation,selectedStageSummary,groupCompetencyControls,awardPanel,savePanel}: Props) {
  return <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" }, mb: 2.5 }}><Box><Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Record badgework</Typography><Typography color="text.secondary">Changes below are drafts until you select Save changes.</Typography></Box><Button variant="outlined" onClick={onChangeMembers}>Change members</Button></Stack>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 3 }}><Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography sx={{ fontWeight: 800 }}>{selectedCount} selected:</Typography>{members.map((member) => <Chip key={member.id} size="small" label={`${member.displayName} · ${member.section}`} />)}</Stack></Paper>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) auto" }, gap: 2, alignItems: "center", mb: 2 }}>
            <FormControl fullWidth><InputLabel id="badgework-record-skill-label">Adventure Skill</InputLabel><Select autoFocus={autoFocusSkill} id="badgework-record-skill" labelId="badgework-record-skill-label" label="Adventure Skill" value={skill?.id ?? ""} onChange={(event) => onChangeSkill(event.target.value)}>{adventureSkills.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</Select></FormControl>
            <Button variant="outlined" color="success" disabled={saving} onClick={onCompleteStage} sx={{ minHeight: 48, whiteSpace: "nowrap" }}>Mark full stage complete</Button>
          </Box>
          {stageNavigation}
          {!fromSource && selectedStageSummary}
          {fromSource && groupCompetencyControls}
          {fromSource && selectedCount > 1 && <Accordion disableGutters sx={{ mt: 2, mb: 2 }} data-testid="badgework-meeting-exceptions"><AccordionSummary expandIcon={<Typography component="span" aria-hidden="true">⌄</Typography>}><Box><Typography sx={{ fontWeight: 800 }}>Review individual progress and exceptions</Typography><Typography variant="body2" color="text.secondary">Open this only when selected children completed different competency points.</Typography></Box></AccordionSummary><AccordionDetails>{selectedStageSummary}</AccordionDetails></Accordion>}
          {fromSource && selectedCount === 1 && <Box sx={{ mt: 2 }}>{selectedStageSummary}</Box>}



          {awardPanel}

          {!fromSource && groupCompetencyControls}
          {savePanel}
        </Paper>;
}
