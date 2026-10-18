import { Button, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import type { EventRecord } from "../../services/eventAdmin";
import type { MemberRecord } from "../../services/memberAdmin";
import { eventAudienceSummary, eventCounts, eventStatusLabel } from "../../services/eventManagementLogic";
import { scheduleToday } from "../../services/scheduleSelection";
import ScheduleTiles from "./ScheduleTiles";

export default function EventSchedule({ events, members }: { events: EventRecord[]; members: MemberRecord[] }) {
  return <ScheduleTiles label="Events" items={events.map(event => {
    const summary = eventCounts(event, members);
    const href = `/leader/events/${encodeURIComponent(event.id)}`;
    const editable = event.startDate >= scheduleToday() && event.status !== "completed";
    return {
      id: event.id, date: event.startDate, endDate: event.endDate, title: event.title,
      content: <Stack spacing={1}>
        <Typography>{event.section} · {event.eventType} · {eventStatusLabel(event.status)}</Typography>
        {event.location && <Typography>{event.location}</Typography>}
        {event.description && <Typography>{event.description}</Typography>}
        <Typography>{event.audience ? eventAudienceSummary(event.audience.sectionIds, event.audience.memberIds, event.audience.resolvedMemberIds.length) : `Audience: ${event.section}`}</Typography>
        <Typography>{summary.attending} attending · {summary.notAttending} not attending · {summary.invited} invited</Typography>
        <Typography>{event.consentRequired ? `${summary.consentReceived} consent received · ${summary.consentOutstanding} consent outstanding` : "Consent not required"}</Typography>
      </Stack>,
      actions: <>
        <Button component={Link} to={href} variant="outlined" color="secondary">View event</Button>
        {editable && <Button component={Link} to={`${href}/edit`} variant="contained" color="secondary">Edit event</Button>}
      </>
    };
  })} />;
}
