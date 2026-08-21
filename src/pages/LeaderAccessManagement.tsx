import { Alert, Box, Button, Chip, Container, MenuItem, Paper, Select, Stack, Switch, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import type { SystemRole } from "../components/admin/AdminAuthProvider";
import { loadLeaderAccessRecords, updateLeaderAccess } from "../services/leaderAccess";
import type { LeaderAccessRecord } from "../services/leaderAccess";

const sections = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group"];

export default function LeaderAccessManagement() {
  const { user, adminProfile } = useAdminAuth();
  const [records, setRecords] = useState<LeaderAccessRecord[]>([]);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      setRecords(await loadLeaderAccessRecords());
      setError("");
    } catch (e) {
      console.error(e);
      setError("Unable to load leader access records.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (!adminProfile || !["admin", "super-admin"].includes(adminProfile.role)) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
        <Alert severity="error">Administrator access is required.</Alert>
      </Container>
    );
  }

  const save = async (record: LeaderAccessRecord) => {
    if (!user) return;
    try {
      await updateLeaderAccess(record.uid, record.role, record.sections, record.active, user.uid);
      await refresh();
    } catch (e) {
      console.error(e);
      setError("Unable to update this leader. Check that your role permits this change.");
    }
  };

  const patch = (uid: string, change: Partial<LeaderAccessRecord>) =>
    setRecords((items) =>
      items.map((item) => (item.uid === uid ? { ...item, ...change } : item))
    );

  const toggleSection = (record: LeaderAccessRecord, section: string) => {
    const selected = record.sections.includes(section);
    patch(record.uid, {
      sections: selected
        ? record.sections.filter((value) => value !== section)
        : [...record.sections, section]
    });
  };

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
      <Container maxWidth="xl">
        <LeaderDashboardHeader />
        <LeaderPageHeader
          title="Leader Access"
          description="Admins manage leader section assignments. Only a Super Admin can grant or remove Admin access."
          actions={
            <Button variant="outlined" color="secondary" onClick={() => void refresh()}>
              Refresh
            </Button>
          }
        />

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Stack spacing={2}>
          {records.map((record) => (
            <Paper
              key={record.uid}
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 2.5, md: 3 },
                borderRadius: 2
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  flexDirection: { xs: "column", sm: "row" },
                  alignItems: { xs: "flex-start", sm: "center" },
                  justifyContent: "space-between"
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{record.displayName}</Typography>
                  <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{record.email}</Typography>
                </Box>
                <Chip
                  label={record.role}
                  color={record.role === "super-admin" ? "error" : record.role === "admin" ? "warning" : "default"}
                />
              </Box>

              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  flexDirection: { xs: "column", sm: "row" },
                  flexWrap: "wrap",
                  alignItems: { xs: "stretch", sm: "center" },
                  mt: 2
                }}
              >
                <Select
                  size="small"
                  value={record.role}
                  disabled={adminProfile.role !== "super-admin" || record.role === "super-admin"}
                  onChange={(e) => patch(record.uid, { role: e.target.value as SystemRole })}
                  sx={{ minWidth: { xs: "100%", sm: 180 } }}
                >
                  <MenuItem value="leader">Leader</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  {record.role === "super-admin" && <MenuItem value="super-admin">Super Admin</MenuItem>}
                </Select>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Switch
                    checked={record.active}
                    disabled={record.role === "super-admin"}
                    onChange={(e) => patch(record.uid, { active: e.target.checked })}
                  />
                  <Typography>Active</Typography>
                </Box>
              </Box>

              {record.role === "leader" && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Sections
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "repeat(2, minmax(0, 1fr))",
                        sm: "repeat(3, minmax(0, 1fr))",
                        md: "repeat(6, minmax(0, 1fr))"
                      },
                      gap: 1
                    }}
                  >
                    {sections.map((section) => {
                      const selected = record.sections.includes(section);
                      return (
                        <Button
                          key={section}
                          variant={selected ? "contained" : "outlined"}
                          color="secondary"
                          size="small"
                          fullWidth
                          onClick={() => toggleSection(record, section)}
                          aria-pressed={selected}
                        >
                          {section}
                        </Button>
                      );
                    })}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {record.sections.length
                      ? `Selected: ${record.sections.join(", ")}`
                      : "No sections selected."}
                  </Typography>
                </Box>
              )}

              <Button
                variant="contained"
                color="secondary"
                sx={{ mt: 2, width: { xs: "100%", sm: "auto" } }}
                disabled={record.role === "super-admin"}
                onClick={() => void save(record)}
              >
                Save Access
              </Button>
            </Paper>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
