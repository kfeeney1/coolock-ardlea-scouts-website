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

type MenuItemDefinition = {
    name: string;
    path: string;
};

const menuItems: MenuItemDefinition[] = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
    { name: "Activities", path: "/activities" },
    { name: "Consent Form", path: "/activities/consent" },
    { name: "Contact", path: "/contact" }
];

export default function Header() {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    return (
        <AppBar position="sticky" elevation={3} sx={{ backgroundColor: "primary.main", borderBottom: `4px solid ${brandColours.navy}` }}>
            <Toolbar sx={{ minHeight: { xs: 72, md: 82 } }}>
                <Box component={Link} to="/" sx={{ display: "flex", alignItems: "center", textDecoration: "none", color: "inherit", flexGrow: 1, minWidth: 0 }}>
                    <Box component="img" src={logo} alt="80th 160th Coolock Ardlea Scout Group" sx={{ width: { xs: 52, md: 64 }, height: { xs: 52, md: 64 }, objectFit: "contain", mr: { xs: 1.25, md: 2 }, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, fontSize: { xs: "1rem", sm: "1.15rem" } }}>80th 160th</Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.2, display: { xs: "none", sm: "block" } }}>Coolock Ardlea Scout Group</Typography>
                    </Box>
                </Box>

                <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}>
                    {menuItems.map((item) => (
                        <Button key={item.name} component={Link} to={item.path} color="inherit" sx={{ color: "white", px: 1.5, "&:hover": { backgroundColor: "secondary.main" } }}>
                            {item.name}
                        </Button>
                    ))}

                    <Button component={Link} to="/join" variant="contained" color="success" sx={{ ml: 1.5, boxShadow: "none" }}>
                        Join Us
                    </Button>

                    <Button component={Link} to="/leader/login" variant="contained" color="secondary" sx={{ ml: 1, boxShadow: "none" }}>
                        Leader Login
                    </Button>
                </Box>

                <Box sx={{ display: { xs: "flex", md: "none" } }}>
                    <IconButton color="inherit" onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="Open navigation menu">
                        <MenuIcon />
                    </IconButton>
                    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                        {menuItems.map((item) => (
                            <MenuItem key={item.name} component={Link} to={item.path} onClick={() => setAnchorEl(null)}>{item.name}</MenuItem>
                        ))}
                        <MenuItem component={Link} to="/join" onClick={() => setAnchorEl(null)} sx={{ color: "success.dark", fontWeight: 800 }}>Join Us</MenuItem>
                        <MenuItem component={Link} to="/leader/login" onClick={() => setAnchorEl(null)} sx={{ color: "secondary.main", fontWeight: 800 }}>Leader Login</MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    );
}
