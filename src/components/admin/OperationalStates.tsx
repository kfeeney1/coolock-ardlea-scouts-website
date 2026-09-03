import type { ReactNode } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

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
            aria-live="polite"
            aria-label={label}
            sx={{ minHeight, display: "grid", placeItems: "center" }}
        >
            <Stack spacing={1.5} sx={{ alignItems: "center" }}>
                <CircularProgress color="secondary" size={28} />
                <Typography variant="body2" color="text.secondary">{label}</Typography>
            </Stack>
        </Box>
    );
}

type StateProps = {
    title?: string;
    children: ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    testId?: string;
};

function OperationalAlert({
    severity,
    title,
    children,
    actionLabel,
    onAction,
    testId
}: StateProps & { severity: "info" | "warning" | "error" }) {
    return (
        <Alert
            severity={severity}
            data-testid={testId}
            action={actionLabel && onAction ? (
                <Button color="inherit" size="small" onClick={onAction}>{actionLabel}</Button>
            ) : undefined}
        >
            {title && <Typography component="div" sx={{ fontWeight: 800, mb: 0.25 }}>{title}</Typography>}
            {children}
        </Alert>
    );
}

export function OperationalEmptyState(props: StateProps) {
    return <OperationalAlert severity="info" {...props} />;
}

export function OperationalUnavailableState(props: StateProps) {
    return <OperationalAlert severity="warning" {...props} />;
}

export function OperationalPermissionState(props: StateProps) {
    return <OperationalAlert severity="warning" {...props} />;
}

export function OperationalErrorState(props: StateProps) {
    return <OperationalAlert severity="error" {...props} />;
}
