import { Box, Button, Collapse, Paper, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthProvider";

type NavItem = { label: string; path: string; adminOnly?: boolean; };
const navItems: NavItem[] = [
 { label: "Member Management", path: "/leader/members" },
 { label: "Member History", path: "/leader/member-history" },
 { label: "Weekly Tracker", path: "/leader/weekly" },
 { label: "Attendance Insights", path: "/leader/attendance" },
 { label: "Organisational Chart", path: "/leader/organisation" },
 { label: "Parent Communications", path: "/leader/communications" },
 { label: "Events & Activities", path: "/leader/events" },
 { label: "Meeting Records", path: "/leader/meetings" },
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
 const location = useLocation();
 const navigate = useNavigate();
 const { adminProfile, logout } = useAdminAuth();
 const [menuOpen, setMenuOpen] = useState(false);
 const [signingOut, setSigningOut] = useState(false);
 const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
 const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);
 const currentItem = visibleItems.find((item) => item.path === location.pathname);
 const handleSignOut = async () => {
  setSigningOut(true);
  try {
   await logout();
   navigate("/leader/login", { replace: true });
  } finally {
   setSigningOut(false);
  }
 };
 return <Paper elevation={3} sx={{ p: { xs: 2.5, md: 3 }, mb: 3, borderRadius: 2, borderTop: "6px solid", borderTopColor: "secondary.main" }}>
  <Box>
   <Typography variant="h3" color="secondary" sx={{ fontWeight: 800, mb: 0.75 }}>Leader Dashboard</Typography>
   <Typography color="text.secondary" sx={{ mb: 1 }}>{adminProfile?.displayName} · {adminProfile?.role}{adminProfile?.role === "leader" && adminProfile.sections.length ? ` · ${adminProfile.sections.join(", ")}` : ""}</Typography>
  </Box>
  <Typography color="text.secondary" sx={{ mb: 2.5 }}>Manage the records permitted by your assigned role and sections.</Typography>
  <Button fullWidth variant="outlined" color="secondary" aria-expanded={menuOpen} aria-controls="leader-navigation" onClick={() => setMenuOpen((open) => !open)} endIcon={<ExpandMoreIcon sx={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }} />} sx={{ minHeight: 48, justifyContent: "space-between", fontWeight: 800 }}>{menuOpen ? "Hide Leader Menu" : currentItem ? `Menu · ${currentItem.label}` : "Open Leader Menu"}</Button>
  <Collapse in={menuOpen} timeout="auto" unmountOnExit><Box id="leader-navigation" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.25, alignItems: "stretch", mt: 1.5 }}>
   {visibleItems.map((item) => { const active = location.pathname === item.path; return <Button key={item.path} component={Link} to={item.path} onClick={() => setMenuOpen(false)} variant={active ? "contained" : "outlined"} color="secondary" sx={{ width: "100%", minHeight: 44, px: 2, whiteSpace: "nowrap", fontWeight: 700 }}>{item.label}</Button>; })}
   <Button variant="outlined" color="secondary" disabled={signingOut} onClick={() => void handleSignOut()} sx={{ width: "100%", minHeight: 44, px: 2, whiteSpace: "nowrap", fontWeight: 700 }}>{signingOut ? "Signing Out…" : "Sign Out"}</Button>
  </Box></Collapse>
 </Paper>;
}
