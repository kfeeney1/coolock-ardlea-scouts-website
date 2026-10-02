import { Box, Checkbox, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";

type MemberSectionChecklistProps = {
  availableSections: readonly string[];
  sections: string[];
  primarySection: string;
  onChange: (sections: string[], primarySection: string) => void;
};

export default function MemberSectionChecklist({
  availableSections,
  sections,
  primarySection,
  onChange
}: MemberSectionChecklistProps) {
  const selected = [...new Set(sections.filter((section) => availableSections.includes(section)))];
  const effectivePrimary = selected.includes(primarySection) ? primarySection : selected[0] || "";

  const toggleSection = (section: string, checked: boolean) => {
    if (checked) {
      const next = selected.includes(section) ? selected : [...selected, section];
      const nextPrimary = effectivePrimary || section;
      onChange([nextPrimary, ...next.filter((item) => item !== nextPrimary)], nextPrimary);
      return;
    }

    if (section === effectivePrimary) return;
    onChange(selected.filter((item) => item !== section), effectivePrimary);
  };

  const changePrimary = (nextPrimary: string) => {
    if (!selected.includes(nextPrimary)) return;
    onChange([nextPrimary, ...selected.filter((item) => item !== nextPrimary)], nextPrimary);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, gridColumn: { md: "1 / -1" } }}>
      <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Sections</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Select every section this member belongs to. The Primary section must stay selected.
      </Typography>
      <Box
        role="group"
        aria-label="Member sections"
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 0.5 }}
      >
        {availableSections.map((section) => (
          <FormControlLabel
            key={section}
            control={
              <Checkbox
                checked={selected.includes(section)}
                disabled={section === effectivePrimary}
                onChange={(event) => toggleSection(section, event.target.checked)}
                slotProps={{ input: { "aria-label": section } }}
              />
            }
            label={section === effectivePrimary ? `${section} (Primary)` : section}
            sx={{ minHeight: 44, m: 0 }}
          />
        ))}
      </Box>
      <Stack sx={{ mt: 2, maxWidth: 360 }}>
        <FormControl required disabled={selected.length === 0}>
          <InputLabel id="member-primary-section-label">Primary section</InputLabel>
          <Select
            labelId="member-primary-section-label"
            label="Primary section"
            value={effectivePrimary}
            onChange={(event) => changePrimary(event.target.value)}
          >
            {selected.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
          </Select>
          <FormHelperText>Primary controls the member's canonical section and must be one of the checked sections.</FormHelperText>
        </FormControl>
      </Stack>
    </Paper>
  );
}
