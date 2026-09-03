import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import {
  OperationalEmptyState,
  OperationalErrorState,
  OperationalLoading,
  OperationalPermissionState
} from "./OperationalStates";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../../services/firestoreErrors";
import {
  createProgrammeLibraryItem,
  deleteProgrammeLibraryItem,
  filterProgrammeLibrary,
  loadProgrammeLibrary,
  programmeLibraryItemToActivity,
  programmeLibraryItemToBadgework
} from "../../services/programmeLibrary";
import type { ProgrammeLibraryDurationFilter, ProgrammeLibraryItem, ProgrammeLibraryKind } from "../../services/programmeLibrary";
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
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | ProgrammeLibraryKind>("all");
  const [durationFilter, setDurationFilter] = useState<ProgrammeLibraryDurationFilter>("all");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visibleItems = useMemo(
    () => filterProgrammeLibrary(items, { search, kind: kindFilter, duration: durationFilter }),
    [items, search, kindFilter, durationFilter]
  );
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await loadProgrammeLibrary([section]));
    } catch (loadFailure) {
      console.error(loadFailure);
      setLoadError(loadFailure);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [section]);
  useEffect(() => {
    if (selectedId && !visibleItems.some((item) => item.id === selectedId)) setSelectedId("");
  }, [selectedId, visibleItems]);

  const saveActivity = async () => {
    const source = activities.find((item) => item.id === activityId);
    if (!source?.activity.trim()) return setError("Choose a named activity to save.");
    setError(""); setMessage("");
    try {
      await createProgrammeLibraryItem({ section, kind: "activity", name: source.activity, leader: source.leader, notes: source.notes, equipment: source.equipment, durationMinutes: source.durationMinutes });
      setMessage(`${source.activity} saved to the ${section} programme library.`);
      setActivityId("");
      await refresh();
    } catch (saveError) { console.error(saveError); setError("Unable to save this activity to the programme library."); }
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
    } catch (saveError) { console.error(saveError); setError("Unable to save this badgework to the programme library."); }
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
    } catch (removeError) { console.error(removeError); setError("Unable to remove this programme library item."); }
  };

  const failureKind = loadError ? classifyFirestoreFailure(loadError) : null;
  const failureMessage = loadError
    ? firestoreFailureMessage(loadError, "Unable to load the programme library for this section. Please try again.")
    : "";

  return <Paper variant="outlined" sx={{ p: 2 }} data-testid="programme-library-panel">
    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Programme Library</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>Search and reuse activities, games and badgework for {section}. Inserting a template always creates a fresh planner row.</Typography>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    {message && <Alert severity="success" sx={{ mb: 1.5 }}>{message}</Alert>}
    {loading ? (
      <OperationalLoading minHeight={120} label="Loading programme library" />
    ) : loadError && failureKind === "permission" ? (
      <OperationalPermissionState title="Programme library access unavailable" actionLabel="Retry" onAction={() => void refresh()}>
        {failureMessage}
      </OperationalPermissionState>
    ) : loadError ? (
      <OperationalErrorState title="Programme library could not be loaded" actionLabel="Retry" onAction={() => void refresh()}>
        {failureMessage}
      </OperationalErrorState>
    ) : (
      <Stack spacing={1.5}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(220px, 1fr) 180px 180px" }, gap: 1 }}>
          <TextField label="Search programme library" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, notes, equipment or leader" slotProps={{ htmlInput: { "data-testid": "programme-library-search" } }} />
          <TextField select label="Type" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "all" | ProgrammeLibraryKind)}>
            <MenuItem value="all">All types</MenuItem><MenuItem value="activity">Activities</MenuItem><MenuItem value="badgework">Badgework</MenuItem>
          </TextField>
          <TextField select label="Duration" value={durationFilter} onChange={(e) => setDurationFilter(e.target.value as ProgrammeLibraryDurationFilter)}>
            <MenuItem value="all">Any duration</MenuItem><MenuItem value="quick">Up to 15 min</MenuItem><MenuItem value="standard">16–30 min</MenuItem><MenuItem value="long">Over 30 min</MenuItem>
          </TextField>
        </Box>
        <Typography variant="body2" color="text.secondary" data-testid="programme-library-result-count" role="status" aria-live="polite">{visibleItems.length} of {items.length} saved items</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr auto auto" }, gap: 1 }}>
          <TextField select fullWidth label="Saved programme item" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={visibleItems.length === 0}>
            {visibleItems.map((item) => <MenuItem key={item.id} value={item.id}>{item.kind === "activity" ? "Activity" : "Badgework"} · {item.name}{item.durationMinutes ? ` · ${item.durationMinutes} min` : ""}</MenuItem>)}
          </TextField>
          <Button variant="contained" onClick={insertSelected} disabled={!selected}>Add to meeting</Button>
          {!readOnly && <Button variant="outlined" color="error" onClick={() => void removeSelected()} disabled={!selected}>Remove</Button>}
        </Box>
        {selected && <Paper variant="outlined" sx={{ p: 1.5 }} data-testid="programme-library-selected-details">
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: selected.notes || selected.equipment ? 1 : 0 }}>
            <Chip size="small" label={selected.kind === "activity" ? "Activity" : "Badgework"} />
            {selected.durationMinutes > 0 && <Chip size="small" variant="outlined" label={`${selected.durationMinutes} min`} />}
            {selected.leader && <Chip size="small" variant="outlined" label={`Leader: ${selected.leader}`} />}
          </Stack>
          {selected.notes && <Typography variant="body2" sx={{ mb: selected.equipment ? 0.5 : 0 }}>{selected.notes}</Typography>}
          {selected.equipment && <Typography variant="body2" color="text.secondary"><strong>Equipment:</strong> {selected.equipment}</Typography>}
        </Paper>}
        {items.length === 0 && (
          <OperationalEmptyState title="No saved programme items">
            No saved programme items for {section} yet. Add a named activity or badgework item from this meeting to start the library.
          </OperationalEmptyState>
        )}
        {items.length > 0 && visibleItems.length === 0 && (
          <OperationalEmptyState title="No matching programme items">
            No saved programme items match the current search and filters. Clear or change the filters to see other saved items.
          </OperationalEmptyState>
        )}
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
    )}
  </Paper>;
}
