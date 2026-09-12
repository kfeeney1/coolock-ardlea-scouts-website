import { Box, CircularProgress } from "@mui/material";
import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import Footer from "./Footer";
import Header from "./Header";

const PRODUCTION_ORIGIN = "https://coolockardleascouts.ie";
const CANONICAL_PUBLIC_PATHS = new Set(["/", "/about", "/activities", "/join", "/contact"]);

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
    const { pathname } = useLocation();
    const isLeaderRoute = pathname.startsWith("/leader") && pathname !== "/leader/login";

    useEffect(() => {
        const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!CANONICAL_PUBLIC_PATHS.has(pathname)) {
            existing?.remove();
            return;
        }

        const canonical = existing ?? document.createElement("link");
        canonical.rel = "canonical";
        canonical.href = new URL(pathname, PRODUCTION_ORIGIN).toString();
        if (!existing) document.head.append(canonical);
    }, [pathname]);

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
                data-leader-route={isLeaderRoute ? "true" : undefined}
                sx={{
                    flexGrow: 1,
                    ...(isLeaderRoute ? {
                        "& > *": {
                            pt: { xs: "24px !important", md: "40px !important" },
                            pb: { xs: "24px !important", md: "40px !important" }
                        },
                        "& > .MuiContainer-root, & > * > .MuiContainer-root": {
                            maxWidth: "1536px !important"
                        }
                    } : {})
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
