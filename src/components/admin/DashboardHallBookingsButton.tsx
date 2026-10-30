import { Button } from "@mui/material";
import { Link } from "react-router-dom";
import { useHallHireAccess } from "../../hooks/useHallHireAccess";
export default function DashboardHallBookingsButton() {
  const access = useHallHireAccess();
  return access.allowed ? <Button component={Link} to="/leader/hall" color="secondary" variant="outlined" sx={{minHeight: 44, mb: 2, ml: {sm: 1}, width: {xs: "100%", sm: "auto"}, borderRadius: 2, fontWeight: 800}}>Hall bookings</Button> : null;
}
