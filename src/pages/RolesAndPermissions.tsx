import { Alert, Box, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import {
  CURRENT_SCOUTING_APPOINTMENTS,
  effectivePermissionsFor,
  PERMISSION_REGISTRY,
  SYSTEM_ACCESS_ROLES
} from "../security/permissionRegistry";
import { isGroupLeadershipAppointment } from "../security/scoutingAppointments";

const areaOrder = [...new Set(PERMISSION_REGISTRY.map((permission) => permission.area))];

const roleSummaries = [
  { label: "Parent / Guardian", role: "parent", description: "Relationship-scoped access to approved linked children only." },
  { label: "Leader", role: "leader", description: "Operational access constrained by assigned sections and Scouting appointments." },
  { label: "Admin", role: "admin", description: "System administration plus ordinary leader operations; cannot grant Admin system access." },
  { label: "Super Admin", role: "super-admin", description: "Protected highest application-level role with the complete non-parent administrative and operational permission set." }
] as const;

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
  const canManageSystemRoles = adminProfile.role === "super-admin";
  const canManageAdminAccess = adminProfile.role === "admin";
  const canDelegateOperationalAccess = isGroupLeadershipAppointment(adminProfile.scoutingRole);
  const canManageOrdinaryAccess = canManageSystemRoles || canManageAdminAccess || canDelegateOperationalAccess;

  const administrationGuidance = canManageSystemRoles
    ? "Super Admin may also promote or demote non-Super-Admin accounts between Leader and Admin. Protected Super Admin accounts cannot be altered here."
    : canManageAdminAccess
      ? "Admin may manage ordinary leader activation, sections and appointments, but cannot grant Admin or Super Admin system access."
      : "Group Leadership may update ordinary Leader section scope and permitted operational appointments, but cannot change activation or any system role.";

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader
        title="Roles & Permissions"
        description="The authoritative access catalogue for system roles and Scouting appointments. Access is enforced by Firebase Rules and route/service checks; this page does not grant access by itself."
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        Permission definitions are security-protected and code-defined because Firebase Rules are part of the enforcement boundary. Runtime checkboxes would be misleading and unsafe unless the backend Rules consumed the same configuration. User role and appointment assignments are managed separately through Leader Access.
      </Alert>

      <Paper data-testid="role-administration" variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.75 }}>Role administration</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Role assignment and permission configuration are intentionally separate. Use Leader Access to change who has an existing role or appointment. The permission definitions below are protected system policy and are changed only with matching application, Firebase Rules and regression-test updates.
        </Typography>
        {canManageOrdinaryAccess ? <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <Button component={Link} to="/leader/access" variant="contained" color="secondary">
            Manage user roles & appointments
          </Button>
          <Typography variant="body2" color="text.secondary">
            {administrationGuidance}
          </Typography>
        </Stack> : <Alert severity="warning">
          Your current role can inspect the permission model but cannot change role or appointment assignments.
        </Alert>}
      </Paper>

      <Box data-testid="system-role-matrix" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2, mb: 3 }}>
        {roleSummaries.map((summary) => {
          const permissionCount = effectivePermissionsFor(summary.role, "").length;
          const protectedRole = summary.role === "super-admin";
          return <Paper key={summary.role} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{summary.label}</Typography>
              {protectedRole && <Chip size="small" color="warning" label="Protected" />}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{summary.description}</Typography>
            <Typography sx={{ mt: 1.5, fontWeight: 700 }}>{permissionCount} base permission entries</Typography>
          </Paper>;
        })}
      </Box>

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
          {adminProfile.displayName} · {adminProfile.role}{adminProfile.scoutingRole ? ` · ${adminProfile.scoutingRole}` : ""}{adminProfile.sections.length ? ` · sections: ${adminProfile.sections.join(", ")}` : ""}
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
                  {permission.protected && <Chip size="small" variant="outlined" label="Protected system policy" />}
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
