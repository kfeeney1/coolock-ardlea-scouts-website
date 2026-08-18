import {
    Box,
    Button,
    Paper,
    Typography
} from "@mui/material";

import {
    Link,
    useLocation
} from "react-router-dom";

type NavItem = {
    label: string;
    path: string;
};

const navItems: NavItem[] = [
    {
        label: "Member Management",
        path: "/leader/members"
    },
    {
        label: "Join Us Management",
        path: "/leader/join"
    },
    {
        label: "Consent Management",
        path: "/leader/consents"
    },
    {
        label: "Info & FAQ",
        path: "/leader/info"
    },
    {
        label: "My Profile",
        path: "/leader/profile"
    }
];

export default function LeaderDashboardHeader() {
    const location = useLocation();

    return (
        <Paper
            elevation={3}
            sx={{
                p: {
                    xs: 2.5,
                    md: 3
                },
                mb: 3,
                borderRadius: 2
            }}
        >
            <Typography
                variant="h3"
                color="secondary"
                sx={{
                    fontWeight: 800,
                    mb: 2
                }}
            >
                Leader Dashboard
            </Typography>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        lg: "repeat(5, minmax(0, 1fr))"
                    },
                    gap: 1.25,
                    alignItems: "stretch"
                }}
            >
                {navItems.map((item) => {
                    const active =
                        location.pathname === item.path;

                    return (
                        <Button
                            key={item.path}
                            component={Link}
                            to={item.path}
                            variant={
                                active
                                    ? "contained"
                                    : "outlined"
                            }
                            color="secondary"
                            sx={{
                                width: "100%",
                                minHeight: 44,
                                whiteSpace: "nowrap"
                            }}
                        >
                            {item.label}
                        </Button>
                    );
                })}
            </Box>
        </Paper>
    );
}
