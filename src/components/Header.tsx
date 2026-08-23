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
import { useState } from "react";
import { Link } from "react-router-dom";

import logo from "../assets/logo.png";
import { brandColours } from "../theme/theme";
import { usePublicSiteContent } from "./PublicSiteContentProvider";

export default function Header() {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const content = usePublicSiteContent();
    const menuItems = content.navigation;

    return <AppBar position="sticky" elevation={3} sx={{ backgroundColor: "primary.main", borderBottom: `4px solid ${brandColours.navy}` }}>
        <Toolbar sx={{ minHeight: { xs: 72, md: 82 } }}>
            <Box component={Link} to="/" sx={{ display: "flex", alignItems: "center", textDecoration: "none", color: "inherit", flexGrow: 1, minWidth: 0 }}>
                <Box component="img" src={logo} alt={content.group.name} sx={{ width: { xs: 52, md: 64 }, height: { xs: 52, md: 64 }, objectFit: "contain", mr: { xs: 1.25, md: 2 }, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}><Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, fontSize: { xs: "1rem", sm: "1.15rem" } }}>{content.group.headerPrimary}</Typography><Typography variant="body2" sx={{ lineHeight: 1.2, display: { xs: "none", sm: "block" } }}>{content.group.headerSecondary}</Typography></Box>
            </Box>
            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}>
                {menuItems.map((item) => <Button key={item.path} component={Link} to={item.path} color="inherit" sx={{ color: "white", px: 1.25, "&:hover": { backgroundColor: "secondary.main" } }}>{item.label}</Button>)}
                <Button component={Link} to="/join" variant="contained" color="success" sx={{ ml: 1, boxShadow: "none" }}>Join Us</Button>
                <Button component={Link} to="/parent" variant="outlined" color="inherit" sx={{ ml: 1, color: "white", borderColor: "rgba(255,255,255,0.75)", fontWeight: 700 }}>Parent Login</Button>
                <Button component={Link} to="/leader/login" variant="contained" color="secondary" sx={{ ml: 1, boxShadow: "none" }}>Leader Login</Button>
            </Box>
            <Box sx={{ display: { xs: "flex", md: "none" } }}><IconButton color="inherit" onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="Open navigation menu"><MenuIcon /></IconButton><Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>{menuItems.map((item) => <MenuItem key={item.path} component={Link} to={item.path} onClick={() => setAnchorEl(null)}>{item.label}</MenuItem>)}<MenuItem component={Link} to="/join" onClick={() => setAnchorEl(null)} sx={{ color: "success.dark", fontWeight: 800 }}>Join Us</MenuItem><MenuItem component={Link} to="/parent" onClick={() => setAnchorEl(null)} sx={{ color: "primary.dark", fontWeight: 800 }}>Parent Login</MenuItem><MenuItem component={Link} to="/leader/login" onClick={() => setAnchorEl(null)} sx={{ color: "secondary.main", fontWeight: 800 }}>Leader Login</MenuItem></Menu></Box>
        </Toolbar>
    </AppBar>;
}
