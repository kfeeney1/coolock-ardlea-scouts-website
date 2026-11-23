import { Alert, Button, CircularProgress, Container, List, ListItem, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { readMemberMedical, type MemberMedicalEntry } from "../services/memberMedical";

export default function MemberMedicalDirectory() {
  const [members, setMembers] = useState<MemberMedicalEntry[]>();
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let current = true;
    void readMemberMedical<{ members: MemberMedicalEntry[] }>(null).then(
      result => { if (current) setMembers(result.members); },
      () => { if (current) setFailed(true); }
    );
    return () => { current = false; };
  }, []);

  const filtered = members?.filter(member => `${member.name} ${member.section}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Member Medical Information" />
    <Stack spacing={2}>
      {failed && <Alert severity="error">Unable to load the medical directory.</Alert>}
      {!failed && !members && <CircularProgress aria-label="Loading medical directory" />}
      {members && <TextField label="Search by member name or section" value={search} onChange={event => setSearch(event.target.value)} />}
      {filtered?.length === 0 && <Alert severity="info" role="status">No matching members with a linked consent record.</Alert>}
      {!!filtered?.length && <List disablePadding>
        {filtered.map(member => <ListItem key={member.consentId} disableGutters>
          <Button component={Link} to={`/leader/medical/${encodeURIComponent(member.consentId)}`}
            state={{ returnTo: "/leader/medical", returnLabel: "Back to medical directory" }} variant="outlined" fullWidth>
            {member.name}{member.section && ` · ${member.section}`}
          </Button>
        </ListItem>)}
      </List>}
    </Stack>
  </Container>;
}
