import { Box, Button, Collapse, Paper, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EventIcon from "@mui/icons-material/Event";
import PeopleIcon from "@mui/icons-material/People";
import DescriptionIcon from "@mui/icons-material/Description";
import InventoryIcon from "@mui/icons-material/Inventory";
import SettingsIcon from "@mui/icons-material/Settings";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PaymentsIcon from "@mui/icons-material/Payments";
import type { ReactNode } from "react";
import type { LeaderNavGroup, LeaderNavItem } from "../../navigation/leaderNavigation";

const categories: Record<string, { description: string; icon: ReactNode }> = {
  programme: { description: "Meetings, events and badgework", icon: <EventIcon /> },
  "people-parents": { description: "Members, families and consent", icon: <PeopleIcon /> },
  secretary: { description: "Group meeting records", icon: <DescriptionIcon /> },
  quartermaster: { description: "Equipment, stores and reports", icon: <InventoryIcon /> },
  treasurer: { description: "Subscriptions, floats and finance", icon: <PaymentsIcon /> },
  "group-operations": { description: "Day-to-day group operations", icon: <SettingsIcon /> },
  "insights-records": { description: "Attendance, reporting and audit", icon: <AssessmentIcon /> },
  "super-admin": { description: "System information and administration", icon: <SettingsIcon /> },
  administration: { description: "Access, settings and system administration", icon: <SettingsIcon /> }
};

export default function RedesignedLeaderNavigation({ groups, expanded, setExpanded, renderItem }: {
  groups: LeaderNavGroup[]; expanded: string | null; setExpanded: (id: string | null) => void;
  renderItem: (item: LeaderNavItem) => ReactNode;
}) {
  const order = ["programme", "people-parents", "secretary", "quartermaster", "group-operations", "treasurer", "insights-records", "administration", "super-admin"];
  const redesignedGroups = groups.flatMap((group) => {
    if (group.id !== "administration") return [group];
    const ordinary = group.items.filter((item) => !item.superAdminOnly);
    const system = group.items.filter((item) => item.superAdminOnly);
    return [
      ...(ordinary.length ? [{ ...group, items: ordinary }] : []),
      ...(system.length ? [{ id: "super-admin", label: "Super Admin", items: system }] : [])
    ];
  }).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return <Stack spacing={1} data-testid="leader-navigation-redesigned">
    {redesignedGroups.map((group) => {
      const open = expanded === group.id;
      const category = categories[group.id];
      const heading = `redesigned-${group.id}-heading`;
      const panel = `redesigned-${group.id}-panel`;
      return <Paper key={group.id} variant="outlined" sx={{ overflow: "hidden", borderRadius: 2 }}>
        <Button fullWidth data-control-role="menu" variant="text" color="secondary" id={heading} aria-expanded={open} aria-controls={panel}
          onClick={() => setExpanded(open ? null : group.id)}
          startIcon={category.icon} endIcon={<ExpandMoreIcon sx={{ transform: open ? "rotate(180deg)" : "none" }} />}
          sx={{ minHeight: 64, borderRadius: 1, textTransform: "none", justifyContent: "flex-start", px: 2, gap: 1, "& .MuiButton-endIcon": { ml: "auto" }, "&:focus-visible": { outline: "3px solid", outlineColor: "secondary.main", outlineOffset: -3 } }}>
          <Box component="span" sx={{ textAlign: "left", flex: 1 }}>
            <Typography component="span" sx={{ display: "block", fontWeight: 800 }}>{group.label}</Typography>
            <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block", textTransform: "none" }}>{category.description}</Typography>
          </Box>
        </Button>
        <Collapse in={open} timeout={0} unmountOnExit>
          <Stack id={panel} role="region" aria-labelledby={heading} spacing={0.5} sx={{ px: 1, pb: 1 }}>{group.items.map(renderItem)}</Stack>
        </Collapse>
      </Paper>;
    })}
  </Stack>;
}
