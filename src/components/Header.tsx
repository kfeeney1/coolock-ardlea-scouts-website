import {
    AppBar,
    Box,
    Button,
    IconButton,
    Menu,
    MenuItem,
    Toolbar,
    Typography
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import logo from "../assets/logo.png";
import { useBackDismiss } from "../hooks/useBackDismiss";
import { brandColours } from "../theme/theme";
import { usePublicSiteContent } from "./PublicSiteContentProvider";
import { useAdminAuth } from "./admin/AdminAuthProvider";

export default function Header() {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [signingOut, setSigningOut] = useState(false);
    const { user, logout } = useAdminAuth();
    const navigate = useNavigate();
    const content = usePublicSiteContent();
    const menuItems = content.navigation;
    const menuHistoryReady = useBackDismiss(Boolean(anchorEl), () => setAnchorEl(null), "public-mobile-navigation");
    const pendingSignOutDestination = signingOut
        ? (window.location.pathname.startsWith("/leader") ? "/leader/login" : "/")
        : null;
    useEffect(() => {
        if (pendingSignOutDestination && !user) {
            setAnchorEl(null);
            setSigningOut(false);
            navigate(pendingSignOutDestination, { replace: true });
        }
    }, [navigate, pendingSignOutDestination, user]);
    const handleSignOut = async () => {
        if (signingOut) return;
        setSigningOut(true);
        try {
            await logout();
        } catch (error) {
            console.error("Unable to sign out:", error);
            setSigningOut(false);
            setAnchorEl(null);
        }
    };

    return <AppBar data-site-sticky-header data-theme-surface="header" position="sticky" elevation={3} sx={{ backgroundColor: "primary.main", borderBottom: `4px solid ${brandColours.navy}` }}>
        <Toolbar sx={{ minHeight: { xs: 72, md: 82 } }}>
            <Box component={Link} to="/" sx={{ display: "flex", alignItems: "center", textDecoration: "none", color: "inherit", flexGrow: 1, minWidth: 0 }}>
                <Box component="img" src={logo} alt={content.group.name} sx={{ width: { xs: 52, md: 64 }, height: { xs: 52, md: 64 }, objectFit: "contain", mr: { xs: 1.25, md: 2 }, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}><Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, fontSize: { xs: "1rem", sm: "1.15rem" } }}>{content.group.headerPrimary}</Typography><Typography variant="body2" sx={{ lineHeight: 1.2, display: { xs: "none", sm: "block" } }}>{content.group.headerSecondary}</Typography></Box>
            </Box>
            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}>
                {menuItems.map((item) => <Button key={item.path} component={Link} to={item.path} color="inherit" sx={{ color: "white", px: 1.25, "&:hover": { backgroundColor: "secondary.main" } }}>{item.label}</Button>)}
                <Button component={Link} to="/join" variant="contained" color="success" sx={{ ml: 1, boxShadow: "none" }}>Join Us</Button>
                <Button component={Link} to="/parent" variant="outlined" color="inherit" sx={{ ml: 1, color: "white", borderColor: "rgba(255,255,255,0.75)", fontWeight: 700 }}>Parent Login</Button>
                {user && !window.location.pathname.startsWith("/leader") ? <Button onClick={() => void handleSignOut()} disabled={signingOut} variant="contained" color="secondary" sx={{ ml: 1, boxShadow: "none" }}>{signingOut ? "Signing Out…" : "Sign Out"}</Button> : !user ? <Button component={Link} to="/leader/login" variant="contained" color="secondary" sx={{ ml: 1, boxShadow: "none" }}>Leader Login</Button> : null}
            </Box>
            <Box sx={{ display: { xs: "flex", md: "none" } }}><IconButton color="inherit" onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="Open navigation menu"><MenuIcon /></IconButton><Menu anchorEl={anchorEl} open={Boolean(anchorEl) && menuHistoryReady} onClose={() => setAnchorEl(null)}>{menuItems.map((item) => <MenuItem key={item.path} component={Link} to={item.path} replace>{item.label}</MenuItem>)}<MenuItem component={Link} to="/join" replace sx={{ color: "success.dark", fontWeight: 800 }}>Join Us</MenuItem><MenuItem component={Link} to="/parent" replace sx={{ color: "primary.dark", fontWeight: 800 }}>Parent Login</MenuItem>{user ? <MenuItem component="button" disabled={signingOut} onClick={() => void handleSignOut()} sx={{ color: "secondary.main", fontWeight: 800, width: "100%" }}>{signingOut ? "Signing Out…" : "Sign Out"}</MenuItem> : <MenuItem component={Link} to="/leader/login" replace sx={{ color: "secondary.main", fontWeight: 800 }}>Leader Login</MenuItem>}</Menu></Box>
        </Toolbar>
    </AppBar>;
}
