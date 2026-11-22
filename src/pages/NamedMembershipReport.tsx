import { Alert, Button, CircularProgress, Container, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { namedMembershipAccess } from "../security/membershipTotalsAccess";
import { applicationErrorMessage } from "../services/applicationErrors";
import { recordAuditEvent } from "../services/auditLog";
import { downloadCsv } from "../services/downloadCsv";
import { loadNamedMembershipRows } from "../services/reporting";
import { memberReportCsv, type MemberReportRow } from "../services/reportingLogic";

export default function NamedMembershipReport() {
  const { adminProfile, user } = useAdminAuth();
  const access = useMemo(() => namedMembershipAccess(adminProfile), [adminProfile]);
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Member List Report" />
    {access.canOpen ? <MemberList key={JSON.stringify([user?.uid, access])} access={access} /> :
      <Alert severity="error">You do not have access to this report.</Alert>}
  </Container>;
}

function MemberList({ access }: { access: ReturnType<typeof namedMembershipAccess> }) {
  const [rows, setRows] = useState<MemberReportRow[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void loadNamedMembershipRows({ isAdmin: access.group, sections: access.sections }).then(
      data => { if (current) setRows(data); },
      failure => { if (current) setError(applicationErrorMessage(failure, "Unable to load the member list.", "NamedMembershipReport")); }
    );
    return () => { current = false; };
  }, [access]);
  function exportMembers() {
    if (!access.group || !rows?.length) return;
    downloadCsv(`member-report-${new Date().toISOString().slice(0, 10)}.csv`, memberReportCsv(rows));
    void recordAuditEvent({ category: "system", action: "Member report exported", targetId: "member-report", targetLabel: "Member report", description: `Exported ${rows.length} member rows with approved guardian contact fields.`, section: "All sections" });
  }
  const columns = ["Member", "Section", "Status", ...(access.group ? ["Parent / Guardian", "Email", "Mobile"] : [])];
  return <Stack spacing={2}>
    <Typography>Scope: {access.group ? "All sections" : access.sections.join(", ")}</Typography>
    {error ? <Alert severity="error">{error}</Alert> : !rows ? <CircularProgress aria-label="Loading member list" /> :
      !rows.length ? <Typography role="status">No members in this scope.</Typography> : <>
        {access.group && <Button variant="outlined" onClick={exportMembers}>Export Member CSV</Button>}
        <TableContainer component={Paper} variant="outlined" tabIndex={0} role="region" aria-label="Member list">
          <Table size="small" aria-label="Member list">
            <TableHead><TableRow>{columns.map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
            <TableBody>{rows.map(row => <TableRow key={row.id}>
              <TableCell component="th" scope="row">{row.displayName}</TableCell>
              <TableCell>{row.section}</TableCell><TableCell>{row.status}</TableCell>
              {access.group && <><TableCell>{row.parentName}</TableCell><TableCell>{row.emailAddress}</TableCell><TableCell>{row.mobileNumber}</TableCell></>}
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </>}
  </Stack>;
}
