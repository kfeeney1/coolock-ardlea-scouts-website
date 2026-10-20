import { Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { WeeklyMeetingRecord } from "../../services/weeklyTracker";
import { scheduleRecordActions } from "../../services/scheduleRecordActions";
import ScheduleTiles from "./ScheduleTiles";
import ExpandableMeetingNotes from "./ExpandableMeetingNotes";

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
      const activities = record.activities.filter(item => item.activity.trim());
      const badges = record.badgeworkPlan.filter(item => item.badge.trim());
      const canChange = !readOnly && (canEditAll || sections.includes(record.section));
      const actions = scheduleRecordActions(record.meetingDate, record.status === "open", canChange);
      return {
        id: record.id, date: record.meetingDate, title: `${record.section} · ${record.theme || "Weekly meeting"}`,
        content: selected => <Stack spacing={2}>
          <Typography>{record.status === "open" ? "Open meeting" : "Closed meeting"}{record.location ? ` · ${record.location}` : ""}</Typography>
          <div><Typography color="secondary" sx={{ fontWeight: 800 }}>Games & activities · {activities.length}</Typography>
            {activities.length ? activities.map(activity => <Typography key={activity.id}>{activity.activity || "Untitled activity"}</Typography>) : <Typography color="text.secondary">No games or activities planned.</Typography>}</div>
          <div><Typography color="secondary" sx={{ fontWeight: 800 }}>Badgework · {badges.length}</Typography>
            {badges.length ? badges.map(badge => <Typography key={badge.id}>{badge.badge || "Untitled badgework"}</Typography>) : <Typography color="text.secondary">No badgework planned.</Typography>}</div>
          {record.programmeNotes && <ExpandableMeetingNotes key={selected ? "active" : "inactive"} notes={record.programmeNotes} />}
        </Stack>,
        actions: <>
          <Button component={Link} to={href} variant="contained" color="secondary">{actions.edit ? "Edit meeting" : "View meeting"}</Button>
          {actions.copy && <Button component={Link} to={`/leader/weekly/copy/${encodeURIComponent(record.id)}`} variant="outlined" color="secondary">Copy meeting</Button>}
        </>
      };
    })} />
  </Stack>;
}
