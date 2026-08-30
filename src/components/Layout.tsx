import { Box, CircularProgress } from "@mui/material";
import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import Footer from "./Footer";
import Header from "./Header";

function RouteFallback() {
    return (
        <Box
            role="status"
            aria-live="polite"
            aria-label="Loading page"
            sx={{
                minHeight: { xs: "55vh", md: "60vh" },
                display: "grid",
                placeItems: "center"
            }}
        >
            <CircularProgress color="success" size={36} />
        </Box>
    );
}

export default function Layout() {
    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column"
            }}
        >
            <Header />

            <Box
                component="main"
                sx={{
                    flexGrow: 1
                }}
            >
                <Suspense fallback={<RouteFallback />}>
                    <Outlet />
                </Suspense>
            </Box>

            <Footer />
        </Box>
    );
}
