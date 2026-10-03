import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { YOUTH_ROLES_BY_SECTION, normalizeMemberSectionRoles, setMemberSectionRole, type MemberSectionRoles } from "../../services/memberYouthRoles";

type Props = { sections: readonly string[]; roles?: MemberSectionRoles; onChange: (roles: MemberSectionRoles) => void };

export default function MemberYouthRoleControls({ sections, roles, onChange }: Props) {
  const current = normalizeMemberSectionRoles(roles, sections);
  const applicable = sections.filter((section) => YOUTH_ROLES_BY_SECTION[section]);
  if (applicable.length === 0) return null;
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, gridColumn: { md: "1 / -1" } }} data-testid="member-section-youth-roles">
    <Typography variant="subtitle1" sx={{ fontWeight: 700, gridColumn: { md: "1 / -1" } }}>Section youth leadership roles</Typography>
    {applicable.map((section) => {
      const labelId = `youth-role-${section.toLowerCase()}-label`;
      return <FormControl key={section} fullWidth>
        <InputLabel id={labelId}>{section} role</InputLabel>
        <Select labelId={labelId} label={`${section} role`} value={current[section] || ""} onChange={(event) => onChange(setMemberSectionRole(current, section, event.target.value, sections))}>
          <MenuItem value="">No role</MenuItem>
          {YOUTH_ROLES_BY_SECTION[section].map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
        </Select>
      </FormControl>;
    })}
  </Box>;
}
