import { Alert, Box, Button, Checkbox, Chip, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { selectedMemberSummary } from "../../services/adventureSkillSelectionLogic.ts";
import type { MemberRecord } from "../../services/memberAdmin";
type Props = { search: string; section: string; sections: string[]; visibleMembers: MemberRecord[]; selectedIds: string[]; allVisibleSelected: boolean; someVisibleSelected: boolean; onSearchChange: (value: string) => void; onSectionChange: (value: string) => void; onToggleAllVisible: () => void; onClearSelection: () => void; onToggleMember: (id: string) => void; onContinue: () => void };
export default function BadgeworkMemberSelection({search,section,sections,visibleMembers,selectedIds,allVisibleSelected,someVisibleSelected,onSearchChange,onSectionChange,onToggleAllVisible,onClearSelection,onToggleMember,onContinue}: Props) { return (<Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h5" color="secondary" sx={{ fontWeight: 800, mb: .75 }}>Select members</Typography>
          <Typography color="text.secondary" sx={{ mb: 2.5 }}>Choose the child or children whose badgework you want to update, then continue to the competency screen.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2, mb: 2 }}>
            <TextField label="Search children" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Name or section" />
            <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={section} onChange={(event) => onSectionChange(event.target.value)}>{sections.map((item) => <MenuItem key={item} value={item}>{item === "all" ? "All sections" : item}</MenuItem>)}</Select></FormControl>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2, alignItems: { sm: "center" } }}>
            <FormControlLabel control={<Checkbox checked={allVisibleSelected} indeterminate={someVisibleSelected} onChange={onToggleAllVisible} />} label="Select all shown" />
            <Chip color={selectedIds.length ? "success" : "default"} label={selectedMemberSummary(selectedIds, visibleMembers.length)} />
            {selectedIds.length > 0 && <Button size="small" onClick={onClearSelection}>Clear selection</Button>}
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
            {visibleMembers.map((member) => <Paper key={member.id} variant="outlined" sx={{ p: 1.25 }}><FormControlLabel sx={{ m: 0, width: "100%", alignItems: "flex-start" }} control={<Checkbox checked={selectedIds.includes(member.id)} onChange={() => onToggleMember(member.id)} />} label={<Box sx={{ pt: .75 }}><Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography><Typography variant="body2" color="text.secondary">{member.section}</Typography></Box>} /></Paper>)}
          </Box>
          {visibleMembers.length === 0 && <Alert severity="info" sx={{ mt: 2 }}>No active children match the current filters.</Alert>}
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}><Button variant="contained" color="success" size="large" disabled={!selectedIds.length} onClick={onContinue}>Select {selectedIds.length || ""} {selectedIds.length === 1 ? "member" : "members"} and continue</Button></Box>
        </Paper>); }
