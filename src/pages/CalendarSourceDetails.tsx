import { Alert, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { db } from "../firebase";
import { useCalendarAccess } from "../hooks/useCalendarAccess";
import { calendarReturnPath, calendarSourceEntry, type CalendarSourceCollection } from "../services/calendarSourceLogic";
import { formatSiteDate } from "../services/siteDateFormat";
import ExpandableMeetingNotes from "../components/admin/ExpandableMeetingNotes";
const safeCollections = ["parentWeeklyMeetings", "parentGalleryEvents", "publicEvents"];
export default function CalendarSourceDetails() {
  const {collection = "", id = ""} = useParams();
  const access = useCalendarAccess();
  const location = useLocation();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({key: "", data: null as Record<string, unknown> | null, loaded: false, error: false});
  const key = JSON.stringify([access.allowed, access.revision, collection, id, attempt]);
  const valid = safeCollections.includes(collection) && Boolean(id) && !id.includes("/");
  useEffect(() => {
    setState({key, data: null, loaded: false, error: false});
    if (!access.allowed || !valid) return;
    return onSnapshot(doc(db, collection, id), {includeMetadataChanges: true}, snapshot => {
      if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) setState({key, data: snapshot.data() || null, loaded: true, error: false});
    }, () => setState({key, data: null, loaded: true, error: true}));
  }, [key, access.allowed, valid, collection, id]);
  const data = access.allowed && state.key === key ? state.data : null;
  const entry = data && valid ? calendarSourceEntry(collection as CalendarSourceCollection, id, data) : null;
  const back = calendarReturnPath(location.state) || "/calendar";
  const items = data ? [...(Array.isArray(data.activities) ? data.activities : []), ...(Array.isArray(data.badgework) ? data.badgework : [])] : [];
  return <Container maxWidth="md" sx={{py: 4}}><Stack spacing={2}>
    <Button component={Link} to={access.allowed ? back : "/parent"} sx={{alignSelf: "flex-start", minHeight: 44}}>{access.allowed ? "Back to calendar" : "Back to Parent Portal"}</Button>
    {access.loading || (access.allowed && valid && (state.key !== key || !state.loaded)) ? <Typography role="status">Loading programme…</Typography> : !access.allowed ? <Alert severity="info">{access.error || "Calendar is disabled or this account no longer has access."}</Alert> : !entry ? <><Alert severity={state.error ? "error" : "info"}>This programme is unavailable. It may have been removed or no longer be shared with your account.</Alert><Button onClick={() => setAttempt(value => value + 1)} sx={{minHeight: 44}}>Retry programme</Button></> : <Paper variant="outlined" sx={{p: 3, borderRadius: 3, borderTop: "6px solid", borderTopColor: "secondary.main", overflowWrap: "anywhere"}}>
      <Stack spacing={2}>
        <Typography component="h1" variant="h4" color="secondary">{entry.title}</Typography>
        <Typography>{entry.type === "meeting" ? "Meeting" : "Event"} · {entry.section === "Group" ? "Group-wide" : entry.section}{entry.state ? ` · ${entry.state}` : ""}</Typography>
        <Typography>{formatSiteDate(entry.date)}{entry.endDate && entry.endDate !== entry.date ? ` – ${formatSiteDate(entry.endDate)}` : ""} · All day</Typography>
        {typeof data?.location === "string" && data.location && <Typography>{data.location}</Typography>}
        {typeof data?.description === "string" && data.description && <ExpandableMeetingNotes notes={data.description} />}
        {items.map((item, index) => item && typeof item === "object" && typeof item.name === "string" ? <Typography key={index}>{item.name}{typeof item.durationMinutes === "number" && item.durationMinutes > 0 ? ` · ${item.durationMinutes} minutes` : ""}</Typography> : null)}
      </Stack>
    </Paper>}
  </Stack></Container>;
}
