import { Button } from "@mui/material";
import { Link } from "react-router-dom";
import { canViewJoinManagement, waitingListEntrySections } from "../../security/joinManagementAccess";
import { useAdminAuth } from "./AdminAuthProvider";

export default function DashboardWaitingListButton() {
  const { adminProfile } = useAdminAuth();
  const canView = canViewJoinManagement(adminProfile);
  if (!canView && waitingListEntrySections(adminProfile).length === 0) return null;

  return <Button
    component={Link}
    to={canView ? "/leader/join?status=waiting-list" : "/leader/join/add"}
    color="secondary"
    variant="outlined"
    sx={{ minHeight: 44, mb: 2, ml: { sm: 1 }, width: { xs: "100%", sm: "auto" }, borderRadius: 2, fontWeight: 800 }}
  >
    {canView ? "Waiting list" : "Add to waiting list"}
  </Button>;
}
