import { Box, Button, Paper, Typography } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthProvider";

type NavItem = { label: string; path: string; adminOnly?: boolean; };
const navItems: NavItem[] = [
 { label: "Member Management", path: "/leader/members" },
 { label: "Member History", path: "/leader/member-history" },
 { label: "Attendance Insights", path: "/leader/attendance" },
 { label: "Events & Activities", path: "/leader/events" },
 { label: "Reports & Exports", path: "/leader/reports" },
 { label: "Event Consent", path: "/leader/event-consent" },
 { label: "Leader Requests", path: "/leader/requests", adminOnly: true },
 { label: "Parent Access", path: "/leader/parent-access", adminOnly: true },
 { label: "Leader Access", path: "/leader/access", adminOnly: true },
 { label: "Activity Log", path: "/leader/activity", adminOnly: true },
 { label: "Parent Portal", path: "/parent" },
 { label: "Join Us Management", path: "/leader/join" },
 { label: "Consent Management", path: "/leader/consents" },
 { label: "Info & FAQ", path: "/leader/info" },
 { label: "My Profile", path: "/leader/profile" }
];
export default function LeaderDashboardHeader() {
 const location = useLocation(); const { adminProfile } = useAdminAuth(); const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
 return <Paper elevation={3} sx={{ p: { xs: 2.5, md: 3 }, mb: 3, borderRadius: 2, borderTop: "6px solid", borderTopColor: "secondary.main" }}>
  <Typography variant="h3" color="secondary" sx={{ fontWeight: 800, mb: 0.75 }}>Leader Dashboard</Typography>
  <Typography color="text.secondary" sx={{ mb: 1 }}>{adminProfile?.displayName} · {adminProfile?.role}{adminProfile?.role === "leader" && adminProfile.sections.length ? ` · ${adminProfile.sections.join(", ")}` : ""}</Typography>
  <Typography color="text.secondary" sx={{ mb: 2.5 }}>Manage the records permitted by your assigned role and sections.</Typography>
  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.25, alignItems: "stretch" }}>
   {navItems.filter((item) => !item.adminOnly || isAdmin).map((item) => { const active = location.pathname === item.path; return <Button key={item.path} component={Link} to={item.path} variant={active ? "contained" : "outlined"} color="secondary" sx={{ width: "100%", minHeight: 44, px: 2, whiteSpace: "nowrap", fontWeight: 700 }}>{item.label}</Button>; })}
  </Box>
 </Paper>;
}
