import { Button } from "@mui/material";
import { Link } from "react-router-dom";
import { useCalendarAccess } from "../../hooks/useCalendarAccess";
export default function DashboardCalendarButton() {
  const calendar = useCalendarAccess();
  return calendar.enabled && calendar.allowed ? <Button component={Link} to="/calendar" data-testid="dashboard-calendar" variant="outlined" color="secondary" sx={{minHeight: 44, mb: 2, width: {xs: "100%", sm: "auto"}, borderRadius: 2, fontWeight: 800}}>Calendar</Button> : null;
}
