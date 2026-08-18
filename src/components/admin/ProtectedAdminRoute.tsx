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
