import { Alert, Box, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import {
  CURRENT_SCOUTING_APPOINTMENTS,
  effectivePermissionsFor,
  PERMISSION_REGISTRY,
  SYSTEM_ACCESS_ROLES
} from "../security/permissionRegistry";

const areaOrder = [...new Set(PERMISSION_REGISTRY.map((permission) => permission.area))];

function GrantChips({ grants }: { grants: readonly string[] }) {
  return <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
    {grants.map((grant) => <Chip key={grant} size="small" label={grant} />)}
  </Stack>;
}

export default function RolesAndPermissions() {
  const { adminProfile } = useAdminAuth();
  if (!adminProfile) return null;

  const effective = effectivePermissionsFor(adminProfile.role, adminProfile.scoutingRole);
  const effectiveIds = new Set(effective.map((permission) => permission.id));

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader
        title="Roles & Permissions"
        description="The authoritative access catalogue for system roles and Scouting appointments. Access is enforced by Firebase Rules and route/service checks; this page does not grant access by itself."
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        Permissions are currently code-defined. Runtime permission switches are intentionally not offered because the existing architecture cannot safely make a client-configured switch change Firebase authorization. Role and appointment changes are managed separately in Leader Access & Organisation and remain server-enforced.
      </Alert>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2, mb: 3 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>System access roles</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>These determine account-level access. Appointments never silently promote a user to Admin or Super Admin.</Typography>
          <GrantChips grants={SYSTEM_ACCESS_ROLES} />
        </Paper>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Scouting appointments</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Appointments can add narrowly defined operational permissions while retaining the person&apos;s system role.</Typography>
          <GrantChips grants={CURRENT_SCOUTING_APPOINTMENTS} />
        </Paper>
      </Box>

      <Paper data-testid="effective-permissions" variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.75 }}>Your effective permissions</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {adminProfile.displayName} · {adminProfile.role}{adminProfile.scoutingRole ? ` · ${adminProfile.scoutingRole}` : ""} · sections: {adminProfile.sections.join(", ")}
        </Typography>
        <Typography sx={{ fontWeight: 700 }}>{effective.length} permission entries apply to this profile.</Typography>
      </Paper>

      <Stack spacing={3}>
        {areaOrder.map((area) => {
          const permissions = PERMISSION_REGISTRY.filter((permission) => permission.area === area);
          return <Box component="section" key={area} aria-labelledby={`permissions-${area.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}>
            <Typography id={`permissions-${area.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`} variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 1.5 }}>{area}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
              {permissions.map((permission) => <Paper
                key={permission.id}
                data-testid={`permission-${permission.id}`}
                variant="outlined"
                sx={{ p: 2, borderRadius: 2, borderWidth: effectiveIds.has(permission.id) ? 2 : 1 }}
              >
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }}>{permission.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{permission.id}</Typography>
                  </Box>
                  <Chip size="small" color={effectiveIds.has(permission.id) ? "success" : "default"} label={effectiveIds.has(permission.id) ? "Effective for you" : "Not granted"} />
                </Box>
                <Typography sx={{ mt: 1.25 }}>{permission.description}</Typography>
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: 1.5, flexWrap: "wrap" }}>
                  <Chip size="small" variant="outlined" label={`Scope: ${permission.scope}`} />
                  {permission.protected && <Chip size="small" variant="outlined" label="Code-defined / protected" />}
                </Stack>
                <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.75, fontWeight: 800 }}>Granted by default</Typography>
                <GrantChips grants={permission.grantedBy} />
                <Typography variant="subtitle2" sx={{ mt: 1.5, fontWeight: 800 }}>Enforced at</Typography>
                <Typography variant="body2" color="text.secondary">{permission.enforcement.join(" · ")}</Typography>
              </Paper>)}
            </Box>
          </Box>;
        })}
      </Stack>
    </Container>
  </Box>;
}
