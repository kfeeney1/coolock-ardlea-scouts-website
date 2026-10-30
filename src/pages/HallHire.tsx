import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { usePublicSiteContent } from "../components/PublicSiteContentProvider";
import PublicHallCalendar from "../components/hall/PublicHallCalendar";
import DatePickerField from "../components/DatePickerField";
import ActionLinkButton from "../components/ActionLinkButton";
import { usePublicHallHire } from "../hooks/usePublicHallHire";
import { usePublicHallAvailability } from "../hooks/usePublicHallAvailability";
import { hallEnquiryLink, publicHallDay, publicHallTime } from "../services/publicHallAvailability.ts";
import { hallVenueFacts, type HallVenueFacts } from "../services/hallVenueFacts.ts";
import { groupLocalDate } from "../services/groupLocalDate.ts";
import { formatSiteDate } from "../services/siteDateFormat";
import { SITE_IDENTITY } from "../content/siteIdentity";

function HallHireContent() {
  const content = usePublicSiteContent(), today = groupLocalDate();
  const [month, setMonth] = useState(today.slice(0, 7)), [selected, setSelected] = useState(today);
  const [startTime, setStartTime] = useState(""), [endTime, setEndTime] = useState(""), [invalidDate, setInvalidDate] = useState(false);
  const [facts, setFacts] = useState<HallVenueFacts | null>(null);
  const availability = usePublicHallAvailability(month);
  const heading = useRef<HTMLHeadingElement>(null), detail = useRef<HTMLElement>(null);
  useEffect(() => onSnapshot(doc(db, "siteSettings/hallHireVenue"), {includeMetadataChanges: true}, snapshot => {if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) setFacts(hallVenueFacts(snapshot.data()));}, () => setFacts(null)), []);
  const choose = (date: string, focus = true) => {setSelected(date); setMonth(date.slice(0, 7)); setInvalidDate(false); if (focus) requestAnimationFrame(() => detail.current?.focus());};
  let enquiry = "", enquiryError = "";
  try {enquiry = hallEnquiryLink(SITE_IDENTITY.publicEmail, selected, startTime, endTime);} catch (failure) {enquiryError = failure instanceof Error ? failure.message : "Check the requested date and times.";}
  const times = !availability.loading && !availability.error ? availability.days[selected] ?? publicHallDay(selected) : null;
  return <Container maxWidth="xl" sx={{py: {xs: 2, md: 4}, px: {xs: 1, sm: 3}, overflowWrap: "anywhere"}}><Stack spacing={3} data-testid="public-hall-hire">
    <Paper variant="outlined" sx={{p: {xs: 2, sm: 4}, borderRadius: 3, bgcolor: "background.paper"}}><Stack direction={{xs: "column", md: "row"}} spacing={3} sx={{alignItems: "center"}}><Box sx={{flex: 1}}><Typography color="text.secondary" sx={{fontWeight: 700}}>{content.group.name}</Typography><Typography component="h1" variant="h3" sx={{fontWeight: 800, mt: 1}}>{facts?.name || "Hall hire"}</Typography><Typography sx={{mt: 2}}>{facts?.introduction || "Check unreserved times and contact the group about hiring the hall."}</Typography><Button component="a" href="#hall-availability" color="secondary" variant="contained" sx={{mt: 2, minHeight: 44, borderRadius: 2}} onClick={() => heading.current?.focus()}>Check availability</Button></Box>{facts?.imageUrl && <Box component="img" src={facts.imageUrl} alt={facts.imageAlt} loading="lazy" referrerPolicy="no-referrer" sx={{width: {xs: "100%", md: "45%"}, maxHeight: 300, objectFit: "cover", borderRadius: 2}} />}</Stack></Paper>
    {(facts?.facilities.length || facts?.accessibility) ? <Paper variant="outlined" sx={{p: 2, borderRadius: 3}}><Typography component="h2" variant="h5">Venue information</Typography>{Boolean(facts.facilities.length) && <Box component="ul">{facts.facilities.map(value => <li key={value}>{value}</li>)}</Box>}{facts.accessibility && <Typography>{facts.accessibility}</Typography>}</Paper> : null}
    <Box sx={{display: "grid", gridTemplateColumns: {xs: "minmax(0, 1fr)", lg: "minmax(0, 2fr) minmax(280px, 1fr)"}, gap: 3, alignItems: "start"}}>
      <Stack spacing={2} sx={{minWidth: 0}}><Typography id="hall-availability" ref={heading} tabIndex={-1} component="h2" variant="h4" sx={{fontWeight: 800}}>Availability</Typography><Typography>Occupied times are unavailable. Unreserved times can be requested by enquiry.</Typography>
        {availability.loading ? <Typography role="status">Loading live availability…</Typography> : availability.error ? <Alert severity="error">{availability.error}<Button onClick={availability.retry}>Retry availability</Button></Alert> : <><PublicHallCalendar month={month} today={today} days={availability.days} selected={selected} choose={date => choose(date)} changeMonth={value => {setMonth(value); setSelected(`${value}-01`);}} /><Paper component="section" ref={detail} tabIndex={-1} aria-label={`Times for ${formatSiteDate(selected)}`} variant="outlined" sx={{p: 2, borderRadius: 3, maxHeight: 380, overflowY: "auto"}}><Typography component="h3" variant="h6">{formatSiteDate(selected)}</Typography><Stack spacing={1} sx={{mt: 1}}>{times?.occupied.map(slot => <Typography key={`occupied:${slot.start}`}>Occupied · {publicHallTime(slot.start, selected)}–{publicHallTime(slot.end, selected, true)}</Typography>)}{!times?.occupied.length && <Typography>No occupied slots recorded.</Typography>}{times?.available.map(slot => <Typography key={`available:${slot.start}`}>Unreserved · {publicHallTime(slot.start, selected)}–{publicHallTime(slot.end, selected, true)}</Typography>)}{!times?.available.length && <Typography>Full day occupied.</Typography>}</Stack></Paper></>}
      </Stack>
      <Paper component="section" aria-labelledby="hall-enquiry-title" variant="outlined" sx={{p: {xs: 2, sm: 3}, borderRadius: 3, minWidth: 0}}><Stack spacing={2}><Typography id="hall-enquiry-title" component="h2" variant="h5">Enquire about hall hire</Typography><DatePickerField label="Requested date" value={selected} minDate="2000-01-01" maxDate="2099-12-31" onInputValidityChange={valid => setInvalidDate(!valid)} onChange={event => choose(event.target.value, false)} required /><Stack direction={{xs: "column", sm: "row", lg: "column"}} spacing={2}>{([['start', 'Requested start time'], ['end', 'Requested end time']] as const).map(([key, label]) => <TextField fullWidth key={key} type="time" label={label} value={key === "start" ? startTime : endTime} onChange={event => key === "start" ? setStartTime(event.target.value) : setEndTime(event.target.value)} slotProps={{inputLabel: {shrink: true}, htmlInput: {step: 60}}} />)}</Stack>{enquiryError && <Alert severity="error">{enquiryError}</Alert>}<Typography variant="body2">An enquiry does not confirm a booking. The group will confirm availability and hire arrangements separately.</Typography><Button component="a" href={enquiry || undefined} disabled={invalidDate || Boolean(enquiryError)} color="secondary" variant="contained" sx={{minHeight: 44}}>Enquire by email</Button><Typography variant="body2" color="text.secondary">Your email app opens with the requested date and times. This website does not store your enquiry. Read our <ActionLinkButton to="/privacy">Privacy information</ActionLinkButton>.</Typography></Stack></Paper>
    </Box>
    <Paper component="section" variant="outlined" sx={{p: {xs: 2, sm: 3}, borderRadius: 3}}><Stack spacing={1}><Typography component="h2" variant="h5">{facts?.address ? "Location & contact" : "Contact the group"}</Typography>{facts?.address && <Typography sx={{whiteSpace: "pre-line"}}>{facts.address}</Typography>}<Typography>Contact the group to discuss facilities, access and hire arrangements.</Typography><Button component="a" href={`mailto:${SITE_IDENTITY.publicEmail}`} sx={{minHeight: 44, alignSelf: "start", overflowWrap: "anywhere", maxWidth: "100%", whiteSpace: "normal", textTransform: "none"}}>{SITE_IDENTITY.publicEmail}</Button><Button component={Link} to="/contact" sx={{minHeight: 44, alignSelf: "start"}}>Contact details</Button></Stack></Paper>
  </Stack></Container>;
}
export default function HallHire() {
  const access = usePublicHallHire();
  return access.enabled ? <HallHireContent /> : <Container sx={{py: 4}}><Typography component="h1" variant="h3">Hall hire</Typography><Alert severity={access.error ? "error" : "info"} sx={{my: 2}}>{access.error || "Hall Hire is currently unavailable."}</Alert><Button component={Link} to="/contact" sx={{minHeight: 44}}>Contact the group</Button></Container>;
}
