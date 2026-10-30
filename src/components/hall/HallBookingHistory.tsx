import { useEffect, useState } from "react";
import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { hallBookingHistory, type HallHistory } from "../../services/hallBookingClient";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { formatSiteDate } from "../../services/siteDateFormat";
export default function HallBookingHistory({id}: {id: string}) {
  const [rows, setRows] = useState<HallHistory[]>([]), [cursor, setCursor] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {let active = true; hallBookingHistory(id).then(page => {if (active) {setRows(page.items.map(item => item.value)); setCursor(page.cursor);}}, failure => {if (active) setError(applicationErrorMessage(failure, "Unable to load booking history.", "HallBookingHistory"));}).finally(() => {if (active) setLoading(false);}); return () => {active = false;};}, [id, attempt]);
  return <Paper variant="outlined" sx={{p: 2, borderRadius: 3}}><Stack spacing={1}><Typography component="h2" variant="h6">Booking history</Typography>{loading && <Typography role="status">Loading history…</Typography>}{error && <Alert severity="error">{error}<Button onClick={() => {setError(""); setLoading(true); setAttempt(value => value + 1);}}>Retry history</Button></Alert>}{[...rows].sort((a, b) => b.next.revision - a.next.revision).map(row => <Typography key={row.next.revision}>{formatSiteDate(row.at)} · Revision {row.next.revision} · {row.next.state} · {row.actorUid}</Typography>)}{!loading && !error && !rows.length && <Typography>No history recorded.</Typography>}{cursor && <Button disabled={loading} onClick={async () => {setLoading(true); try {const page = await hallBookingHistory(id, cursor); setRows(value => [...value, ...page.items.map(item => item.value)]); setCursor(page.cursor);} catch (failure) {setError(applicationErrorMessage(failure, "Unable to load more history.", "HallBookingHistory"));} finally {setLoading(false);}}}>Load more history</Button>}</Stack></Paper>;
}
