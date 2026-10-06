import { useEffect, useRef } from "react";
import { Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { WeeklyMeetingRecord } from "../../services/weeklyTracker";

type Props = {
  source: WeeklyMeetingRecord;
  today: string;
  section: string;
  date: string;
  sections: string[];
  saving: boolean;
  onSectionChange: (section: string) => void;
  onDateChange: (date: string) => void;
  onCreate: () => void;
  onCancel: () => void;
};

const displayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(date);
};

export default function WeeklyMeetingCopyForm(props: Props) {
  const form = useRef<HTMLDivElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => {
      form.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      form.current?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
    });
  }, []);

  return <Paper ref={form} data-testid="weekly-meeting-copy-form" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, scrollMarginTop: 16 }}>
    <Typography tabIndex={-1} sx={{ fontWeight: 800, mb: 1 }}>Copy {displayDate(props.source.meetingDate)} · {props.source.section}</Typography>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <Button fullWidth variant="outlined" onClick={() => props.onDateChange(props.today)}>Today</Button>
      <TextField select fullWidth label="Destination section" value={props.section} onChange={(event) => props.onSectionChange(event.target.value)}>{props.sections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</TextField>
      <TextField fullWidth label="Choose date" type="date" value={props.date} onChange={(event) => props.onDateChange(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <Button fullWidth variant="contained" onClick={props.onCreate} disabled={props.saving}>Create Copy</Button>
      <Button fullWidth disabled={props.saving} onClick={props.onCancel}>Cancel</Button>
    </Stack>
  </Paper>;
}
