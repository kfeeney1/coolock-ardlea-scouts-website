import { Button } from "@mui/material";
import { Link } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthProvider";
import { eventRosterExportAccess } from "../../security/eventRosterExportAccess";

export default function EventRosterExportLink({ eventId }: { eventId?: string }) {
  const { adminProfile } = useAdminAuth();
  if (!eventRosterExportAccess(adminProfile).allowed) return null;
  const query = eventId ? `?event=${encodeURIComponent(eventId)}` : "";
  return <Button component={Link} to={`/leader/reports/event-roster${query}`} variant="outlined">Roster exports</Button>;
}
