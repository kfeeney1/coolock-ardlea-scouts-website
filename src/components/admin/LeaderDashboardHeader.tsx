import { Alert, Box, Button, Chip, Collapse, Divider, Paper, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useBackDismiss } from "../../hooks/useBackDismiss";
import { isGroupLeadershipAppointment } from "../../security/scoutingAppointments";
import { useAdminAuth } from "./AdminAuthProvider";
import { THEME_OPTIONS, type ThemeName } from "../../theme/themePreferences";
import { accountNavItems, dashboardNavItem, leaderNavGroups, type LeaderNavItem } from "../../navigation/leaderNavigation";

function matchesNavPath(locationPath: string, itemPath: string) {
 const current = new URL(locationPath, window.location.origin);
 const target = new URL(itemPath, window.location.origin);
 if (target.pathname === "/leader") return current.pathname === "/leader" && !target.search && !target.hash;
 if (current.pathname !== target.pathname && !current.pathname.startsWith(`${target.pathname}/`)) return false;
 if (target.search && current.search !== target.search) return false;
 if (target.hash && current.hash !== target.hash) return false;
 if (!target.search && current.search) return false;
 if (!target.hash && current.hash && current.pathname === target.pathname) return false;
 return true;
}

export default function LeaderDashboardHeader() {
 const location = useLocation();
 const menuButtonRef = useRef<HTMLButtonElement | null>(null);
 const { adminProfile, logout, setUiTheme } = useAdminAuth();
 const activeMobileGroup = leaderNavGroups.find((group) => group.items.some((item) => matchesNavPath(`${location.pathname}${location.search}${location.hash}`, item.path)))?.label ?? null;
 const [menuOpen, setMenuOpen] = useState(false);
 const [mobileGroupOpen, setMobileGroupOpen] = useState<string | null>(activeMobileGroup);
 const [signingOut, setSigningOut] = useState(false);
 const [themeSaving, setThemeSaving] = useState<ThemeName | null>(null);
 const [themeError, setThemeError] = useState("");
 const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
 const isGroupLeadership = isGroupLeadershipAppointment(adminProfile?.scoutingRole);
 const isGroupOfficer = isGroupLeadership || adminProfile?.scoutingRole === "Group Secretary";
 const canViewActivityLog = isAdmin || isGroupOfficer;
 const canViewSettings = isAdmin || isGroupLeadership || adminProfile?.scoutingRole === "Group Treasurer";
 const canViewLeaderAccess = isAdmin || isGroupLeadership;
 const appointments = new Set([adminProfile?.scoutingRole, ...(adminProfile?.appointments.map((item) => item.appointment) ?? [])].filter(Boolean));
 const hasAppointment = (required?: string[]) => !required || isAdmin || required.some((appointment) => appointments.has(appointment));
 const canView = (item: LeaderNavItem) => hasAppointment(item.appointments) && (!item.adminOnly || isAdmin) && (!item.superAdminOnly || adminProfile?.role === "super-admin") && (!item.leaderAccessOnly || canViewLeaderAccess) && (!item.activityLogOnly || canViewActivityLog) && (!item.settingsOnly || canViewSettings);
 const visibleGroups = leaderNavGroups.map((group) => ({ ...group, items: group.items.filter(canView) })).filter((group) => group.items.length > 0);
 const visibleAccountItems = accountNavItems.filter(canView);
 const visibleItems = [dashboardNavItem, ...visibleGroups.flatMap((group) => group.items), ...visibleAccountItems];
 const currentItem = visibleItems.find((item) => matchesNavPath(`${location.pathname}${location.search}${location.hash}`, item.path));
 useEffect(() => { setMobileGroupOpen(activeMobileGroup); }, [activeMobileGroup]);
 const handleMenuToggle = () => { setMenuOpen((open) => { if (!open) setMobileGroupOpen(activeMobileGroup); return !open; }); };
 const closeMenuAndRestoreFocus = () => { setMenuOpen(false); window.requestAnimationFrame(() => menuButtonRef.current?.focus()); };
 const menuHistoryReady = useBackDismiss(menuOpen, closeMenuAndRestoreFocus, "leader-navigation");
 const handleSignOut = async () => { setSigningOut(true); try { await logout(); } finally { setSigningOut(false); } };
 const handleThemeChange = async (theme: ThemeName) => {
  if (theme === adminProfile?.uiTheme || themeSaving) return;
  setThemeSaving(theme); setThemeError("");
  try { await setUiTheme(theme); }
  catch (error) { console.error("Unable to change theme:", error); setThemeError("The look and feel could not be changed. Please try again."); }
  finally { setThemeSaving(null); }
 };
 const navButton = (item: LeaderNavItem) => {
  const active = matchesNavPath(`${location.pathname}${location.search}${location.hash}`, item.path);
  return <Button key={item.id} data-testid={`leader-nav-${item.id}`} component={Link} to={item.path} replace aria-current={active ? "page" : undefined} variant={active ? "contained" : "text"} color="secondary" sx={{ width: "100%", minHeight: 44, px: 1.5, justifyContent: "flex-start", textAlign: "left", fontWeight: active ? 800 : 700 }}>{item.label}</Button>;
 };
 return <Paper data-testid="leader-dashboard-header" elevation={3} sx={{ p: { xs: 1.75, md: 3 }, mb: { xs: 2, md: 3 }, borderRadius: 2, borderTop: "6px solid", borderTopColor: "secondary.main", width: { xs: "calc(100vw - 32px)", md: "calc(100vw - 48px)" }, maxWidth: 1536, position: "relative", left: "50%", transform: "translateX(-50%)", boxSizing: "border-box" }}>
  <Box><Typography variant="h3" color="secondary" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: "1.75rem", md: "3rem" } }}>Leader Dashboard</Typography></Box>
  <Button ref={menuButtonRef} fullWidth variant="outlined" color="secondary" aria-expanded={menuOpen} aria-controls="leader-navigation" onClick={handleMenuToggle} endIcon={<ExpandMoreIcon sx={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }} />} sx={{ minHeight: 48, justifyContent: "space-between", fontWeight: 800 }}>{menuOpen ? "Hide Leader Menu" : currentItem ? `Menu · ${currentItem.label.replace(" ↗", "")}` : "Open Leader Menu"}</Button>
  <Collapse in={menuOpen && menuHistoryReady} timeout={0} unmountOnExit><Box id="leader-navigation" component="nav" aria-label="Leader navigation" onKeyDown={(event) => { if (event.key === "Escape") closeMenuAndRestoreFocus(); }} sx={{ mt: 1.5 }}>
   <Box sx={{ mb: 1.5 }}>{navButton(dashboardNavItem)}</Box>
   <Box data-testid="leader-navigation-mobile" sx={{ display: { xs: "block", md: "none" } }}><Stack spacing={1}>{visibleGroups.map((group) => { const expanded=mobileGroupOpen===group.label; const containsActive=group.items.some((item)=>matchesNavPath(location.pathname,item.path)); const slug=group.label.toLowerCase().replace(/[^a-z0-9]+/g,"-"); const buttonId=`leader-nav-${slug}-button`; const panelId=`leader-nav-${slug}`; return <Paper key={group.label} variant="outlined" sx={{borderRadius:2,overflow:"hidden"}}><Button id={buttonId} fullWidth color="secondary" aria-expanded={expanded} aria-controls={panelId} onClick={()=>setMobileGroupOpen((open)=>open===group.label?null:group.label)} endIcon={<ExpandMoreIcon sx={{transform:expanded?"rotate(180deg)":"none",transition:"transform 160ms ease"}}/>} sx={{minHeight:48,px:1.5,justifyContent:"space-between",fontWeight:containsActive?800:700}}>{group.label}</Button><Collapse in={expanded} timeout="auto" unmountOnExit><Stack id={panelId} role="region" aria-labelledby={buttonId} spacing={0.25} sx={{px:1,pb:1}}>{group.items.map(navButton)}</Stack></Collapse></Paper>; })}</Stack></Box>
   <Box data-testid="leader-navigation-desktop" sx={{display:{xs:"none",md:"grid"},gridTemplateColumns:{md:"repeat(2, minmax(0, 1fr))",xl:"repeat(5, minmax(0, 1fr))"},gap:1.5,alignItems:"start"}}>{visibleGroups.map((group)=><Paper key={group.label} variant="outlined" sx={{p:1.5,borderRadius:2}}><Typography variant="overline" color="text.secondary" sx={{display:"block",px:1.5,pb:0.5,fontWeight:800,letterSpacing:0.8}}>{group.label}</Typography><Stack spacing={0.25}>{group.items.map(navButton)}</Stack></Paper>)}</Box>
   {adminProfile?.role === "super-admin" && <><Divider sx={{my:1.75}}/><Typography variant="overline" color="text.secondary" sx={{display:"block",mb:0.5,fontWeight:800,letterSpacing:0.8}}>Look & feel</Typography><Typography variant="body2" color="text.secondary" sx={{mb:1}}>Preview a visual style across the public site and leader portal. This changes only your Super Admin account.</Typography>{themeError&&<Alert severity="error" sx={{mb:1}}>{themeError}</Alert>}<Box data-testid="theme-menu" sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(2, minmax(0, 1fr))",xl:"repeat(5, minmax(0, 1fr))"},gap:1}}>{THEME_OPTIONS.map((option)=>{const selected=adminProfile.uiTheme===option.name;return <Button key={option.name} variant={selected?"contained":"outlined"} color={selected?"secondary":"primary"} aria-pressed={selected} disabled={Boolean(themeSaving)} onClick={()=>void handleThemeChange(option.name)} sx={{minHeight:76,alignItems:"flex-start",flexDirection:"column",textAlign:"left",p:1.25}}><Box sx={{display:"flex",width:"100%",alignItems:"center",gap:.75}}><span>{themeSaving===option.name?"Applying…":option.label}</span>{option.isNew&&<Chip label="New" size="small" color="success" sx={{ml:"auto"}}/>}</Box><Typography component="span" variant="caption" sx={{mt:.4,opacity:.82,textTransform:"none",lineHeight:1.3}}>{option.description}</Typography></Button>})}</Box></>}
   <Divider sx={{my:1.75}}/><Typography variant="overline" color="text.secondary" sx={{display:"block",mb:0.5,fontWeight:800,letterSpacing:0.8}}>Account & Help</Typography><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(2, minmax(0, 1fr))",lg:"repeat(4, minmax(0, 1fr))"},gap:0.75}}>{visibleAccountItems.map(navButton)}<Button variant="text" color="secondary" disabled={signingOut} onClick={()=>void handleSignOut()} sx={{width:"100%",minHeight:44,px:1.5,justifyContent:"flex-start",fontWeight:700}}>{signingOut?"Signing Out…":"Sign Out"}</Button></Box>
  </Box></Collapse>
 </Paper>;
}
