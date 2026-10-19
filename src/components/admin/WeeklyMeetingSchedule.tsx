import { Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { WeeklyMeetingRecord } from "../../services/weeklyTracker";
import { scheduleToday } from "../../services/scheduleSelection";
import ScheduleTiles from "./ScheduleTiles";

export default function WeeklyMeetingSchedule({ records, readOnly, canEditAll, sections }: {
  records: WeeklyMeetingRecord[]; readOnly: boolean; canEditAll: boolean; sections: string[];
}) {
  const [section, setSection] = useState("all");
  const visible = records.filter(record => section === "all" || record.section === section);
  return <Stack spacing={2}>
    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Meeting schedule</Typography>
    <TextField select label="Schedule section" value={section} onChange={event => setSection(event.target.value)}>
      <MenuItem value="all">All permitted sections</MenuItem>
      {[...new Set(records.map(record => record.section))].sort().map(value => <MenuItem value={value} key={value}>{value}</MenuItem>)}
    </TextField>
    <ScheduleTiles key={section} label="Meetings" items={visible.map(record => {
      const href = `/leader/weekly?meeting=${encodeURIComponent(record.id)}`;
      const canChange = !readOnly && (canEditAll || sections.includes(record.section));
      const future = record.meetingDate >= scheduleToday() && record.status === "open";
      return {
        id: record.id, date: record.meetingDate, title: `${record.section} · ${record.theme || "Weekly meeting"}`,
        content: <Stack spacing={2}>
          <Typography>{record.status === "open" ? "Open meeting" : "Closed meeting"}{record.location ? ` · ${record.location}` : ""}</Typography>
          <div><Typography color="secondary" sx={{ fontWeight: 800 }}>Games & activities · {record.activities.length}</Typography>
            {record.activities.length ? record.activities.map(activity => <Typography key={activity.id}>{activity.activity || "Untitled activity"}</Typography>) : <Typography color="text.secondary">No games or activities planned.</Typography>}</div>
          <div><Typography color="secondary" sx={{ fontWeight: 800 }}>Badgework · {record.badgeworkPlan.length}</Typography>
            {record.badgeworkPlan.length ? record.badgeworkPlan.map(badge => <Typography key={badge.id}>{badge.badge || "Untitled badgework"}</Typography>) : <Typography color="text.secondary">No badgework planned.</Typography>}</div>
          {record.programmeNotes && <Typography>{record.programmeNotes}</Typography>}
        </Stack>,
        actions: <>
          <Button component={Link} to={href} variant="contained" color="secondary">{future && canChange ? "Edit meeting" : "View meeting"}</Button>
          {canChange && <Button component={Link} to={`/leader/weekly/copy/${encodeURIComponent(record.id)}`} variant="outlined" color="secondary">Copy meeting</Button>}
        </>
      };
    })} />
  </Stack>;
}
