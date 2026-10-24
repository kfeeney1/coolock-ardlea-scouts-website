import { useBackDismiss } from "../../hooks/useBackDismiss";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from "@mui/material";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../admin/AdminAuthProvider";
import { effectiveOperationalSections } from "../../services/leaderAccessLogic";
import { formatSiteDate } from "../../services/siteDateFormat";
export default function CalendarDateActions({date, onClose, returnTo, maintenance}: {date: string; onClose: () => void; returnTo: string; maintenance: boolean}) {
  const ready = useBackDismiss(Boolean(date), onClose, "calendar-date-actions");
  const {adminProfile} = useAdminAuth();
  const leader = Boolean(adminProfile && ["leader", "admin", "super-admin"].includes(adminProfile.role));
  const sections = adminProfile ? effectiveOperationalSections(adminProfile.role, adminProfile.sections, adminProfile.appointments) : [];
  const meeting = leader && sections.length > 0 && (adminProfile?.role !== "leader" || adminProfile.scoutingRole !== "Group Secretary");
  const event = leader && sections.length > 0;
  const state = {calendarDate: date, calendarReturnTo: returnTo};
  return <Dialog open={Boolean(date) && ready} onClose={onClose} aria-labelledby="calendar-date-title" fullWidth maxWidth="xs">
    <DialogTitle id="calendar-date-title">{date ? formatSiteDate(date) : "Date actions"}</DialogTitle>
    <DialogContent><Stack spacing={1}>
      {meeting && <Button component={Link} to="/leader/weekly/create" state={state} variant="outlined" color="secondary" sx={{minHeight: 44}}>Add meeting</Button>}
      {event && <Button component={Link} to="/leader/events/create" state={state} variant="outlined" color="secondary" sx={{minHeight: 44}}>Add event</Button>}
      {maintenance && <Button component={Link} to="/calendar/maintenance/new" state={state} variant="outlined" color="secondary" sx={{minHeight: 44}}>Add maintenance</Button>}
      {!meeting && !event && !maintenance && <Alert severity="info">No creation actions are available for your account.</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button autoFocus onClick={onClose} sx={{minHeight: 44}}>Close</Button></DialogActions>
  </Dialog>;
}
