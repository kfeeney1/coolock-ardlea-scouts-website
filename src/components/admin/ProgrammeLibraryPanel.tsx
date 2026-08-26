import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import {
  createProgrammeLibraryItem,
  deleteProgrammeLibraryItem,
  loadProgrammeLibrary,
  programmeLibraryItemToActivity,
  programmeLibraryItemToBadgework
} from "../../services/programmeLibrary";
import type { ProgrammeLibraryItem } from "../../services/programmeLibrary";
import type { WeeklyActivityPlan, WeeklyBadgeworkPlan } from "../../services/weeklyTracker";

type Props = {
  section: string;
  activities: WeeklyActivityPlan[];
  badgework: WeeklyBadgeworkPlan[];
  readOnly: boolean;
  onInsertActivity: (item: WeeklyActivityPlan) => void;
  onInsertBadgework: (item: WeeklyBadgeworkPlan) => void;
};

export default function ProgrammeLibraryPanel({ section, activities, badgework, readOnly, onInsertActivity, onInsertBadgework }: Props) {
  const [items, setItems] = useState<ProgrammeLibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [badgeworkId, setBadgeworkId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await loadProgrammeLibrary([section]));
    } catch (e) {
      console.error(e);
      setError("Unable to load the programme library for this section.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [section]);

  const saveActivity = async () => {
    const source = activities.find((item) => item.id === activityId);
    if (!source?.activity.trim()) return setError("Choose a named activity to save.");
    setError(""); setMessage("");
    try {
      await createProgrammeLibraryItem({ section, kind: "activity", name: source.activity, leader: source.leader, notes: source.notes, equipment: source.equipment, durationMinutes: source.durationMinutes });
      setMessage(`${source.activity} saved to the ${section} programme library.`);
      setActivityId("");
      await refresh();
    } catch (e) { console.error(e); setError("Unable to save this activity to the programme library."); }
  };

  const saveBadgework = async () => {
    const source = badgework.find((item) => item.id === badgeworkId);
    if (!source?.badge.trim()) return setError("Choose named badgework to save.");
    setError(""); setMessage("");
    try {
      await createProgrammeLibraryItem({ section, kind: "badgework", name: source.badge, leader: source.leader, notes: source.notes, equipment: source.equipment, durationMinutes: source.durationMinutes });
      setMessage(`${source.badge} saved to the ${section} programme library.`);
      setBadgeworkId("");
      await refresh();
    } catch (e) { console.error(e); setError("Unable to save this badgework to the programme library."); }
  };

  const insertSelected = () => {
    if (!selected) return;
    if (selected.kind === "activity") onInsertActivity(programmeLibraryItemToActivity(selected));
    else onInsertBadgework(programmeLibraryItemToBadgework(selected));
    setMessage(`${selected.name} added to this meeting as a fresh programme item.`);
  };

  const removeSelected = async () => {
    if (!selected || readOnly) return;
    setError(""); setMessage("");
    try {
      await deleteProgrammeLibraryItem(selected.id);
      setSelectedId("");
      setMessage(`${selected.name} removed from the programme library.`);
      await refresh();
    } catch (e) { console.error(e); setError("Unable to remove this programme library item."); }
  };

  return <Paper variant="outlined" sx={{ p: 2 }} data-testid="programme-library-panel">
    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Programme Library</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>Reuse activities, games and badgework for {section}. Inserting a template creates a fresh planner row only.</Typography>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    {message && <Alert severity="success" sx={{ mb: 1.5 }}>{message}</Alert>}
    <Stack spacing={1.5}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr auto auto" }, gap: 1 }}>
        <TextField select fullWidth label="Saved programme item" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={loading || items.length === 0}>
          {items.map((item) => <MenuItem key={item.id} value={item.id}>{item.kind === "activity" ? "Activity" : "Badgework"} · {item.name}</MenuItem>)}
        </TextField>
        <Button variant="contained" onClick={insertSelected} disabled={!selected}>Add to meeting</Button>
        {!readOnly && <Button variant="outlined" color="error" onClick={() => void removeSelected()} disabled={!selected}>Remove</Button>}
      </Box>
      {items.length === 0 && !loading && <Alert severity="info">No saved programme items for {section} yet.</Alert>}
      {!readOnly && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr auto 1fr auto" }, gap: 1 }}>
        <TextField select label="Save activity / game" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
          {activities.filter((item) => item.activity.trim()).map((item) => <MenuItem key={item.id} value={item.id}>{item.activity}</MenuItem>)}
        </TextField>
        <Button variant="outlined" onClick={() => void saveActivity()} disabled={!activityId}>Save activity</Button>
        <TextField select label="Save badgework" value={badgeworkId} onChange={(e) => setBadgeworkId(e.target.value)}>
          {badgework.filter((item) => item.badge.trim()).map((item) => <MenuItem key={item.id} value={item.id}>{item.badge}</MenuItem>)}
        </TextField>
        <Button variant="outlined" onClick={() => void saveBadgework()} disabled={!badgeworkId}>Save badgework</Button>
      </Box>}
    </Stack>
  </Paper>;
}
