import type { ReactNode } from "react";
import { Alert, Box, CircularProgress } from "@mui/material";

type LoadingProps = {
    minHeight?: number;
    label?: string;
};

export function OperationalLoading({
    minHeight = 160,
    label = "Loading"
}: LoadingProps) {
    return (
        <Box
            role="status"
            aria-label={label}
            sx={{ minHeight, display: "grid", placeItems: "center" }}
        >
            <CircularProgress color="secondary" size={28} />
        </Box>
    );
}

type EmptyProps = {
    children: ReactNode;
};

export function OperationalEmptyState({ children }: EmptyProps) {
    return <Alert severity="info">{children}</Alert>;
}
