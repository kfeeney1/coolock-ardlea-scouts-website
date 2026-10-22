import { Container, IconButton, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../admin/AdminAuthProvider";
import LeaderDashboardHeader from "../admin/LeaderDashboardHeader";

/** Calendar shares the real permission-aware menu and the schedule's card hierarchy. */
export default function CalendarPageLayout({ title, subtitle, back, backLabel, children, wide = false }: {
  title: string; subtitle?: string; back: string; backLabel: string; children: ReactNode; wide?: boolean;
}) {
  const { authorised } = useAdminAuth();
  return <Container maxWidth={wide ? "xl" : "md"} sx={{ py: {xs: 1.5, sm: 3}, px: {xs: 1, sm: 3}, overflowWrap: "anywhere" }}>
    <Stack spacing={2} sx={{minWidth: 0}}>
      {authorised && <LeaderDashboardHeader compact />}
      <Stack direction="row" spacing={1} sx={{alignItems: "center", minWidth: 0}}>
        <IconButton component={Link} to={back} aria-label={backLabel} sx={{minWidth: 44, minHeight: 44, border: "1px solid", borderColor: "divider", color: "text.primary", "&:focus-visible": {outline: "3px solid", outlineColor: "secondary.main"}}}><ArrowBackIcon /></IconButton>
        <div><Typography component="h1" variant="h4" sx={{fontWeight: 800, fontSize: {xs: "1.5rem", sm: "2rem"}, color: "secondary.main"}}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
        </div>
      </Stack>
      {children}
    </Stack>
  </Container>;
}
