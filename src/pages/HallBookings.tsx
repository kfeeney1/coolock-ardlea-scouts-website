import { maintenanceHallSourcePath } from "../services/hallBookingAdministration";
import { useEffect, useState } from "react";
import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import CalendarPageLayout from "../components/calendar/CalendarPageLayout";
import HallBookingEditor from "../components/hall/HallBookingEditor";
import HallBookingHistory from "../components/hall/HallBookingHistory";
import { useHallHireAccess } from "../hooks/useHallHireAccess";
import { applicationErrorMessage } from "../services/applicationErrors";
import { getHallBooking, listHallBookings } from "../services/hallBookingClient";
import { newHallBooking, type HallBookingRecord } from "../services/hallBookingAdministration.ts";
import { formatSiteDate } from "../services/siteDateFormat";

function HallBookingWorkspace() {
  const {bookingId} = useParams(), navigate = useNavigate(), location = useLocation();
  const creating = bookingId === "new";
  const [newId] = useState(() => crypto.randomUUID());
  const [records, setRecords] = useState<HallBookingRecord[]>([]), [record, setRecord] = useState<HallBookingRecord | null>(null), [cursor, setCursor] = useState("");
  const [loading, setLoading] = useState(!creating), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; if (creating) return;
    setLoading(true); setError("");
    const load = async () => {
      try {if (bookingId) {const next = await getHallBooking(bookingId); if (active) setRecord(next);} else {const next = await listHallBookings(); if (active) {setRecords(next.items.map(item => item.value)); setCursor(next.cursor);}}}
      catch (failure) {if (active) setError(applicationErrorMessage(failure, "Unable to load hall bookings.", "HallBookings"));}
      finally {if (active) setLoading(false);}
    }; void load(); return () => {active = false;};
  }, [bookingId, creating, attempt]);
  if (loading) return <Typography role="status">Loading bookings…</Typography>;
  if (error) return <Alert severity="error">{error}<Button onClick={() => setAttempt(value => value + 1)}>Retry bookings</Button></Alert>;
  const saved = (id: string) => {navigate(`/leader/hall/${id}`, {replace: true, state: {hallSaved: true}}); setAttempt(value => value + 1);};
  if (bookingId) return <Stack spacing={2}>{creating ? <HallBookingEditor initial={newHallBooking(newId)} revision={0} saved={saved} /> : record ? <>{record.source ? <Paper variant="outlined" sx={{p: 2, borderRadius: 3}}><Stack spacing={1}><Typography component="h2" variant="h6">{record.title}</Typography><Typography>{formatSiteDate(record.interval.date)} · {record.interval.startTime}–{record.interval.endTime} · {record.state}</Typography><Alert severity="info">This reservation is managed through its original {record.source.collection} record.</Alert>{maintenanceHallSourcePath(record.source) && <Button component={Link} to={maintenanceHallSourcePath(record.source)!}>Open maintenance source</Button>}</Stack></Paper> : <HallBookingEditor key={`${record.id}:${record.revision}`} initial={record} revision={record.revision} saved={saved} savedNotice={Boolean(location.state?.hallSaved)} />}<HallBookingHistory key={`${record.id}:${record.revision}:history`} id={record.id} /></> : <Alert severity="info">This booking is unavailable.</Alert>}</Stack>;
  return <Stack spacing={2} data-testid="hall-booking-list"><Button component={Link} to="/leader/hall/new" color="secondary" variant="contained" sx={{minHeight: 44, alignSelf: "start"}}>New hall booking</Button>{!records.length && <Alert severity="info">No hall bookings recorded.</Alert>}{[...records].sort((a, b) => a.interval.date.localeCompare(b.interval.date) || a.title.localeCompare(b.title)).map(item => <Paper key={item.id} variant="outlined" sx={{p: 2, borderRadius: 3}}><Stack spacing={1}><Typography component="h2" variant="h6">{item.title}</Typography><Typography>{formatSiteDate(item.interval.date)} · {item.interval.startTime}–{item.interval.endTime}{item.interval.endDate !== item.interval.date ? ` · ends ${formatSiteDate(item.interval.endDate)}` : ""}</Typography><Typography>{item.kind} · {item.state}{item.recurrence ? ` · Weekly until ${formatSiteDate(item.recurrence.until)}` : ""}</Typography><Button component={Link} to={`/leader/hall/${item.id}`} sx={{minHeight: 44, alignSelf: "start"}}>View / edit booking</Button></Stack></Paper>)}{cursor && <Button disabled={loading} onClick={async () => {setLoading(true); try {const next = await listHallBookings(cursor); setRecords(value => [...value, ...next.items.map(item => item.value)]); setCursor(next.cursor);} catch (failure) {setError(applicationErrorMessage(failure, "Unable to load more bookings.", "HallBookings"));} finally {setLoading(false);}}}>Load more bookings</Button>}</Stack>;
}
export default function HallBookings() {
  const access = useHallHireAccess(), {bookingId} = useParams();
  return <CalendarPageLayout title="Hall bookings" back={bookingId ? "/leader/hall" : "/leader"} backLabel={bookingId ? "Back to hall bookings" : "Back to Dashboard"}>
    {access.loading ? <Typography role="status">Checking Hall Hire access…</Typography> : !access.allowed ? <Alert severity={access.error ? "error" : "info"}>{access.error || (!access.enabled ? "Hall Hire is currently disabled." : "Group Council membership is required to manage hall bookings.")}{access.error && <Button onClick={access.retry}>Retry access</Button>}</Alert> : <HallBookingWorkspace key={bookingId ?? "list"} />}
  </CalendarPageLayout>;
}
