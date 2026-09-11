import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import type { EquipmentItem } from "../../services/equipment";
import type { EquipmentIncident } from "../../services/equipmentIncidents";
import type { EquipmentLoan } from "../../services/equipmentLoans";
import { availableEquipmentQuantity, outstandingLoanQuantity } from "../../services/equipmentLoanLogic";
import { isEquipmentReservationLoan } from "../../services/equipmentProgrammeLogic";

export type EquipmentDashboardFilter = "all" | "available" | "checked-out" | "unavailable";

type Props = {
  items: EquipmentItem[];
  loans: EquipmentLoan[];
  incidents: EquipmentIncident[];
  onFilterInventory?: (filter: EquipmentDashboardFilter) => void;
};

type Activity = {
  key: string;
  at: Date;
  title: string;
  detail: string;
  tone: "default" | "warning" | "success";
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-IE", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

export default function EquipmentOperationsDashboard({ items, loans, incidents, onFilterInventory }: Props) {
  const activeItems = useMemo(() => items.filter((item) => !item.archived), [items]);
  const totalUnits = useMemo(() => activeItems.reduce((sum, item) => sum + item.totalQuantity, 0), [activeItems]);
  const availableUnits = useMemo(() => activeItems.reduce((sum, item) => sum + availableEquipmentQuantity(item), 0), [activeItems]);
  const checkedOutUnits = useMemo(() => activeItems.reduce((sum, item) => sum + item.checkedOutQuantity, 0), [activeItems]);
  const unavailableUnits = useMemo(() => activeItems.reduce((sum, item) => sum + item.unavailableQuantity, 0), [activeItems]);
  const openDamage = useMemo(() => incidents.filter((incident) => incident.type === "damaged" && incident.status !== "resolved"), [incidents]);
  const openLoans = useMemo(() => loans.filter((loan) => loan.status === "open" && !isEquipmentReservationLoan(loan)), [loans]);

  const activity = useMemo<Activity[]>(() => {
    const entries: Activity[] = [];
    for (const incident of incidents) {
      if (!incident.reportedAt) continue;
      entries.push({
        key: `incident-${incident.id}`,
        at: incident.reportedAt,
        title: incident.type === "damaged" ? `Damage reported · ${incident.itemName}` : `${incident.type.replace("-", " ")} · ${incident.itemName}`,
        detail: `${incident.quantity} affected${incident.section ? ` · ${incident.section}` : ""}${incident.description ? ` · ${incident.description}` : ""}`,
        tone: incident.status === "resolved" ? "success" : "warning"
      });
    }
    for (const loan of loans) {
      if (isEquipmentReservationLoan(loan)) continue;
      const itemSummary = loan.lines.map((line) => `${line.itemName} · ${line.quantity} unit${line.quantity === 1 ? "" : "s"}`).join(", ");
      if (loan.createdAt) entries.push({
        key: `checkout-${loan.id}`,
        at: loan.createdAt,
        title: `Checked out · ${loan.section}`,
        detail: itemSummary,
        tone: "default"
      });
      const returnedQuantity = loan.lines.reduce((sum, line) => sum + line.returnedQuantity, 0);
      if (loan.updatedAt && returnedQuantity > 0) entries.push({
        key: `return-${loan.id}-${loan.updatedAt.getTime()}`,
        at: loan.updatedAt,
        title: `Checked in · ${loan.section}`,
        detail: `${returnedQuantity} returned · ${itemSummary}`,
        tone: "success"
      });
    }
    return entries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 6);
  }, [incidents, loans]);

  const tiles: Array<[string, number, string, EquipmentDashboardFilter]> = [
    ["Stock units", totalUnits, `${activeItems.length} active items`, "all"],
    ["Available", availableUnits, `${checkedOutUnits} checked out`, "available"],
    ["Unavailable", unavailableUnits, openDamage.length ? `${openDamage.length} open damage report${openDamage.length === 1 ? "" : "s"}` : "No open damage", "unavailable"],
    ["Open checkouts", openLoans.length, `${openLoans.reduce((sum, loan) => sum + loan.lines.reduce((lineSum, line) => lineSum + outstandingLoanQuantity(line), 0), 0)} units outstanding`, "checked-out"]
  ];

  return <Paper sx={{ p: { xs: 2, md: 3 }, mb: 2 }} data-testid="equipment-operations-dashboard">
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Equipment overview</Typography>
        <Typography color="text.secondary">A high-level view of stock health and the latest operational activity.</Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1.5 }}>
        {tiles.map(([label, value, helper, filter]) => <Paper
          key={label}
          component="button"
          type="button"
          variant="outlined"
          aria-label={`Show ${label.toLowerCase()} in detailed inventory`}
          onClick={() => onFilterInventory?.(filter)}
          sx={{
            p: 1.75,
            textAlign: "left",
            font: "inherit",
            color: "inherit",
            backgroundColor: "background.paper",
            cursor: onFilterInventory ? "pointer" : "default",
            transition: "border-color 120ms ease, box-shadow 120ms ease",
            "&:hover": onFilterInventory ? { borderColor: "primary.main", boxShadow: 1 } : undefined,
            "&:focus-visible": { outline: "3px solid", outlineColor: "primary.main", outlineOffset: 2 }
          }}
          data-testid={`equipment-dashboard-${filter}`}
        >
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.25 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{helper}</Typography>
        </Paper>)}
      </Box>

      <Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", mb: 1.25 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Recent activity</Typography>
          {openDamage.length > 0 && <Chip size="small" color="warning" label={`${openDamage.length} damage issue${openDamage.length === 1 ? "" : "s"} open`} />}
        </Stack>
        {activity.length === 0 ? <Typography color="text.secondary">No recent equipment activity has been recorded yet.</Typography> : <Stack spacing={1}>
          {activity.map((entry) => <Paper key={entry.key} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{entry.title}</Typography>
                <Typography variant="body2" color="text.secondary">{entry.detail}</Typography>
              </Box>
              <Chip size="small" color={entry.tone === "warning" ? "warning" : entry.tone === "success" ? "success" : "default"} variant="outlined" label={formatDate(entry.at)} sx={{ alignSelf: { xs: "flex-start", sm: "center" } }} />
            </Stack>
          </Paper>)}
        </Stack>}
      </Box>
    </Stack>
  </Paper>;
}
