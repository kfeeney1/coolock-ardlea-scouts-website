import { Alert, Button, CircularProgress, Container, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { membershipTotalsAccess } from "../security/membershipTotalsAccess";
import { applicationErrorMessage } from "../services/applicationErrors";
import { loadMembershipCountRows } from "../services/reporting";
import { membershipSummaryCsv, membershipTotals, type MembershipCountRow } from "../services/reportingLogic";
import { recordAuditEvent } from "../services/auditLog";
import { loadChairpersonReport } from "../services/chairpersonReports";
import { downloadCsv } from "../services/downloadCsv";

export default function MembershipTotalsReport() {
  const { adminProfile, user } = useAdminAuth();
  const access = useMemo(() => membershipTotalsAccess(adminProfile), [adminProfile]);
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <Paper elevation={0} sx={{ "@media print": { display: "none" } }}><LeaderDashboardHeader /></Paper>
    <LeaderPageHeader title="Membership Totals" />
    {access.canOpen ? <MembershipCounts key={JSON.stringify([user?.uid, access])} access={access} /> :
      <Alert severity="error">You do not have access to this report.</Alert>}
  </Container>;
}

function MembershipCounts({ access }: { access: ReturnType<typeof membershipTotalsAccess> }) {
  const [rows, setRows] = useState<MembershipCountRow[]>();
  const [groupTotals, setGroupTotals] = useState<ReturnType<typeof membershipTotals>>();
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void Promise.all([
      access.canExport ? loadMembershipCountRows({ isAdmin: access.group, sections: access.sections }) : [],
      access.chairperson ? loadChairpersonReport<ReturnType<typeof membershipTotals>[number]>("membership") : undefined
    ]).then(
      ([data, totals]) => { if (current) { setRows(data); setGroupTotals(totals); } },
      failure => { if (current) setError(applicationErrorMessage(failure, "Unable to load membership totals.", "MembershipTotalsReport")); }
    );
    return () => { current = false; };
  }, [access]);
  const exportScope = access.group ? "All sections" : access.sections.join(", ");
  const scope = access.chairperson ? "All sections" : exportScope;
  const displayRows = groupTotals ?? (rows?.length ? membershipTotals(rows) : []);
  function exportTotals() {
    if (!access.canExport || !rows?.length) return;
    downloadCsv(`membership-summary-${new Date().toISOString().slice(0, 10)}.csv`, membershipSummaryCsv(rows));
    void recordAuditEvent({ category: "system", action: "Membership summary exported", targetId: "membership-summary", targetLabel: "Membership summary", description: `Exported aggregate totals for ${rows.length} records.`, section: exportScope });
  }
  return <Stack spacing={2}>
    <Typography>Scope: {scope}</Typography>
    {error ? <Alert severity="error">{error}</Alert> : !rows ? <CircularProgress aria-label="Loading membership totals" /> :
      !displayRows.length ? <Typography role="status">No members in this scope.</Typography> : <>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ "@media print": { display: "none" } }}>
          {access.canExport && <Button variant="outlined" onClick={exportTotals}>{access.chairperson ? "Export assigned-section totals" : "Export Membership Summary"}</Button>}
          {access.group && <Button variant="outlined" onClick={() => window.print()}>Print / Save PDF</Button>}
        </Stack>
        <TableContainer component={Paper} variant="outlined" role="region" aria-label="Membership totals" tabIndex={0}>
          <Table size="small" aria-label="Membership totals">
            <TableHead><TableRow>{["Section", "Active", "Inactive", "Left", "Total"].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
            <TableBody>{displayRows.map(row => <TableRow key={row.section}>
              <TableCell component="th" scope="row">{row.section}</TableCell>
              <TableCell>{row.active}</TableCell><TableCell>{row.inactive}</TableCell><TableCell>{row.left}</TableCell><TableCell>{row.total}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </>}
  </Stack>;
}
