import type { ReactNode } from "react";
import { Paper, Stack } from "@mui/material";

type Props = {
    children: ReactNode;
};

export default function OperationalFilterBar({ children }: Props) {
    return (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                useFlexGap
                sx={{ alignItems: { xs: "stretch", md: "center" }, flexWrap: "wrap" }}
            >
                {children}
            </Stack>
        </Paper>
    );
}
