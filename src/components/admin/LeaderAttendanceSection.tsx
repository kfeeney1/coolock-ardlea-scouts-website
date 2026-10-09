import { useMemo, useState } from "react";
import { Alert, Box, Button, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import type { LeaderAttendanceEntry, LeaderAttendanceStatus } from "../../services/leaderAttendance";
import type { WeeklyLeaderOption } from "../../services/weeklyLeaderOptions";

type Props = {
  options: WeeklyLeaderOption[];
  entries: LeaderAttendanceEntry[];
  onChange: (entries: LeaderAttendanceEntry[]) => void;
  disabled?: boolean;
  loading?: boolean;
  sections?: string[];
  groupWide?: boolean;
};

export default function LeaderAttendanceSection({ options, entries, onChange, disabled = false, loading = false }: Props) {
  const [search, setSearch] = useState("");
  const existing = useMemo(() => new Set(entries.map((entry) => entry.leaderUid)), [entries]);
  const results = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (term.length < 2) return [];
    const byUid = new Map<string, WeeklyLeaderOption[]>();
    for (const option of options) {
      const list = byUid.get(option.id) ?? [];
      list.push(option);
      byUid.set(option.id, list);
    }
    return [...byUid.entries()].flatMap(([id, appointments]) => {
      if (existing.has(id)) return [];
      const displayName = appointments[0]?.displayName ?? "";
      const context = [...new Set(appointments.map((item) => `${item.scoutingRole} · ${item.organisationSection}`))];
      return `${displayName} ${context.join(" ")}`.toLocaleLowerCase().includes(term)
        ? [{ id, displayName, appointments, context }]
        : [];
    }).slice(0, 20);
  }, [existing, options, search]);

  const addLeader = (id: string, displayName: string) => {
    const matching = options.filter((option) => option.id === id);
    onChange([...entries, {
      leaderUid: id,
      displayName,
      appointments: [...new Set(matching.map((option) => option.scoutingRole))],
      sections: [...new Set(matching.map((option) => option.organisationSection))],
      attendance: "unrecorded"
    }]);
    setSearch("");
  };

  const update = (uid: string, attendance: LeaderAttendanceStatus) => onChange(entries.map((entry) => entry.leaderUid === uid ? { ...entry, attendance } : entry));

  return <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mt: 2 }} data-testid="leader-attendance-section">
    <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Leader Attendance</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Leader attendance is recorded separately from member attendance.</Typography>
    {!disabled && <Stack spacing={1} sx={{ mb: 2 }}>
      <TextField label="Search active leaders" value={search} disabled={disabled || loading} onChange={(event) => setSearch(event.target.value)} slotProps={{ htmlInput: { "aria-label": "Search active leaders" } }} helperText="Search by name, appointment or section to add a helping leader." />
      {search.trim().length > 0 && search.trim().length < 2 && <Typography variant="caption">Enter at least two characters.</Typography>}
      {results.map((result) => <Box key={result.id} sx={{ display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center", p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
        <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 700 }}>{result.displayName}</Typography><Typography variant="body2" color="text.secondary">{result.context.join("; ")}</Typography></Box>
        <Button disabled={disabled || loading} onClick={() => addLeader(result.id, result.displayName)} aria-label={`Add ${result.displayName}`}>Add</Button>
      </Box>)}
      {search.trim().length >= 2 && results.length === 0 && <Typography variant="body2" color="text.secondary">No other active registered leaders found.</Typography>}
    </Stack>}
    {loading ? <Alert severity="info">Loading leader attendance…</Alert> : entries.length === 0 ? <Alert severity="info">No active registered leaders are appointed to this activity’s selected sections.</Alert> : <Stack spacing={1}>
      {entries.map((entry) => <Box key={entry.leaderUid} data-testid="leader-attendance-row" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0,1fr) 180px" }, gap: 1, alignItems: "center", p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
        <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 700 }}>{entry.displayName}</Typography><Typography variant="body2" color="text.secondary">{[...new Set(entry.appointments.flatMap((appointment) => entry.sections.map((section) => `${appointment} · ${section}`)))].join("; ") || "Helping leader"}</Typography></Box>
        <FormControl size="small" disabled={disabled} fullWidth><InputLabel>Leader attendance</InputLabel><Select label="Leader attendance" value={entry.attendance} onChange={(event) => update(entry.leaderUid, event.target.value as LeaderAttendanceStatus)}><MenuItem value="unrecorded">Not recorded</MenuItem><MenuItem value="present">Present</MenuItem><MenuItem value="absent">Absent</MenuItem></Select></FormControl>
      </Box>)}
    </Stack>}
  </Paper>;
}
