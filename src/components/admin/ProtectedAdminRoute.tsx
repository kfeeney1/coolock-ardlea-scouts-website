import {
    Box,
    CircularProgress
} from "@mui/material";
import type {
    ReactNode
} from "react";
import {
    Navigate,
    useLocation
} from "react-router-dom";

import {
    useAdminAuth
} from "./AdminAuthProvider";

type Props = {
    children: ReactNode;
};

export default function ProtectedAdminRoute({
    children
}: Props) {
    const {
        user,
        loading,
        authorised
    } = useAdminAuth();

    const location = useLocation();

    if (loading) {
        return (
            <Box
                sx={{
                    minHeight: "60vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                <CircularProgress color="success" />
            </Box>
        );
    }

    // A Firebase login by itself never grants leader access.
    // Parent-only users remain authenticated for /parent, but are explicitly
    // redirected away from every protected /leader route unless the same UID
    // also has an active adminUsers record.
    if (user && !authorised) {
        return (
            <Navigate
                to="/parent"
                replace
                state={{
                    leaderAccessDenied: true,
                    from: location.pathname
                }}
            />
        );
    }

    if (!authorised) {
        return (
            <Navigate
                to="/leader/login"
                replace
                state={{
                    from: location.pathname
                }}
            />
        );
    }

    return <>{children}</>;
}
