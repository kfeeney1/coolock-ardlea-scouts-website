import type { ReactNode } from "react";
import { Box } from "@mui/material";

type Props = { title: string; description?: string; actions?: ReactNode; };

export default function LeaderPageHeader({ title, actions }: Props) {
    return <>
        <Box component="h1" sx={{ position: "absolute", width: "1px", height: "1px", p: 0, m: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>{title}</Box>
        {actions && <Box
            data-testid="leader-page-actions"
            aria-label="Page actions"
            sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: { xs: "stretch", sm: "flex-end" }, mb: { xs: 2, md: 3 }, minWidth: 0, "& > *": { flex: { xs: "1 1 100%", sm: "0 1 auto" }, minWidth: 0 } }}
        >{actions}</Box>}
    </>;
}
