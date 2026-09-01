import { Box, Button, Collapse, Divider, Paper, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthProvider";

type NavItem = { label: string; path: string; adminOnly?: boolean; activityLogOnly?: boolean; };
type NavGroup = { label: string; items: NavItem[]; };

const navGroups: NavGroup[] = [
 { label: "Programme", items: [
  { label: "Weekly Meetings", path: "/leader/weekly" },
  { label: "Events & Activities", path: "/leader/events" },
  { label: "Badgework", path: "/leader/badgework" }
 ] },
 { label: "People & Parents", items: [
  { label: "Member Management", path: "/leader/members" },
  { label: "Member History", path: "/leader/member-history" },
  { label: "Join Us Management", path: "/leader/join" },
  { label: "Consent Management", path: "/leader/consents" },
  { label: "Event Consent", path: "/leader/event-consent" },
  { label: "Parent Communications", path: "/leader/communications" }
 ] },
 { label: "Group Operations", items: [
  { label: "Equipment & Stores", path: "/leader/equipment" },
  { label: "Section Floats", path: "/leader/finance" },
  { label: "Meeting Records", path: "/leader/meetings" }
 ] },
 { label: "Insights & Records", items: [
  { label: "Attendance Insights", path: "/leader/attendance" },
  { label: "Reports & Exports", path: "/leader/reports" },
  { label: "Activity Log", path: "/leader/activity", activityLogOnly: true }
 ] },
 { label: "Administration", items: [
  { label: "Leader Requests", path: "/leader/requests", adminOnly: true },
  { label: "Parent Access", path: "/leader/parent-access", adminOnly: true },
  { label: "Leader Access", path: "/leader/access", adminOnly: true },
  { label: "Settings", path: "/leader/settings", adminOnly: true }
 ] }
];

const accountItems: NavItem[] = [
 { label: "My Profile", path: "/leader/profile" },
 { label: "Info & FAQ", path: "/leader/info" },
 { label: "View Parent Portal ↗", path: "/parent" }
];

export default function LeaderDashboardHeader() {
 const location = useLocation();
 const navigate = useNavigate();
 const { adminProfile, logout } = useAdminAuth();
 const initialMobileGroup = navGroups.find((group) => group.items.some((item) => item.path === location.pathname))?.label ?? "Programme";
 const [menuOpen, setMenuOpen] = useState(false);
 const [mobileGroupOpen, setMobileGroupOpen] = useState<string | null>(initialMobileGroup);
 const [signingOut, setSigningOut] = useState(false);
 const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
 const isGroupOfficer = adminProfile?.scoutingRole === "Group Leader" || adminProfile?.scoutingRole === "Group Secretary";
 const canViewActivityLog = isAdmin || isGroupOfficer;
 const canView = (item: NavItem) => (!item.adminOnly || isAdmin) && (!item.activityLogOnly || canViewActivityLog);
 const visibleGroups = navGroups.map((group) => ({ ...group, items: group.items.filter(canView) })).filter((group) => group.items.length > 0);
 const visibleAccountItems = accountItems.filter(canView);
 const visibleItems = [...visibleGroups.flatMap((group) => group.items), ...visibleAccountItems];
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
 const navButton = (item: NavItem) => {
  const active = location.pathname === item.path;
  return <Button key={item.path} component={Link} to={item.path} onClick={() => setMenuOpen(false)} variant={active ? "contained" : "text"} color="secondary" sx={{ width: "100%", minHeight: 44, px: 1.5, justifyContent: "flex-start", textAlign: "left", fontWeight: active ? 800 : 700 }}>{item.label}</Button>;
 };
 return <Paper elevation={3} sx={{ p: { xs: 2.5, md: 3 }, mb: 3, borderRadius: 2, borderTop: "6px solid", borderTopColor: "secondary.main" }}>
  <Box>
   <Typography variant="h3" color="secondary" sx={{ fontWeight: 800, mb: 0.75 }}>Leader Dashboard</Typography>
   <Typography color="text.secondary" sx={{ mb: 1 }}>{adminProfile?.displayName} · {adminProfile?.role}{adminProfile?.role === "leader" && adminProfile.sections.length ? ` · ${adminProfile.sections.join(", ")}` : ""}</Typography>
  </Box>
  <Typography color="text.secondary" sx={{ mb: 2.5 }}>Manage the records permitted by your assigned role and sections.</Typography>
  <Button fullWidth variant="outlined" color="secondary" aria-expanded={menuOpen} aria-controls="leader-navigation" onClick={() => setMenuOpen((open) => !open)} endIcon={<ExpandMoreIcon sx={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }} />} sx={{ minHeight: 48, justifyContent: "space-between", fontWeight: 800 }}>{menuOpen ? "Hide Leader Menu" : currentItem ? `Menu · ${currentItem.label.replace(" ↗", "")}` : "Open Leader Menu"}</Button>
  <Collapse in={menuOpen} timeout="auto" unmountOnExit>
   <Box id="leader-navigation" component="nav" aria-label="Leader navigation" sx={{ mt: 1.5 }}>
    <Box sx={{ display: { xs: "block", md: "none" } }}>
     <Stack spacing={1}>
      {visibleGroups.map((group) => {
       const expanded = mobileGroupOpen === group.label;
       const containsActive = group.items.some((item) => item.path === location.pathname);
       const panelId = `leader-nav-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
       return <Paper key={group.label} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Button fullWidth color="secondary" aria-expanded={expanded} aria-controls={panelId} onClick={() => setMobileGroupOpen((open) => open === group.label ? null : group.label)} endIcon={<ExpandMoreIcon sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }} />} sx={{ minHeight: 48, px: 1.5, justifyContent: "space-between", fontWeight: containsActive ? 800 : 700 }}>{group.label}</Button>
        <Collapse in={expanded} timeout="auto" unmountOnExit><Stack id={panelId} spacing={0.25} sx={{ px: 1, pb: 1 }}>{group.items.map(navButton)}</Stack></Collapse>
       </Paper>;
      })}
     </Stack>
    </Box>
    <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: { md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 1.5, alignItems: "start" }}>
     {visibleGroups.map((group) => <Paper key={group.label} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: "block", px: 1.5, pb: 0.5, fontWeight: 800, letterSpacing: 0.8 }}>{group.label}</Typography>
      <Stack spacing={0.25}>{group.items.map(navButton)}</Stack>
     </Paper>)}
    </Box>
    <Divider sx={{ my: 1.75 }} />
    <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 800, letterSpacing: 0.8 }}>Account & Help</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 0.75 }}>
     {visibleAccountItems.map(navButton)}
     <Button variant="text" color="secondary" disabled={signingOut} onClick={() => void handleSignOut()} sx={{ width: "100%", minHeight: 44, px: 1.5, justifyContent: "flex-start", fontWeight: 700 }}>{signingOut ? "Signing Out…" : "Sign Out"}</Button>
    </Box>
   </Box>
  </Collapse>
 </Paper>;
}
