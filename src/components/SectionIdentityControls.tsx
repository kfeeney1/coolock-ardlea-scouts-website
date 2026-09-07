import { Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, type ButtonProps, type ChipProps, type SelectChangeEvent, type SelectProps } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import { sectionVisualTokens } from "../theme/sectionColours";

function sectionControlSx(section: string | null | undefined): SxProps<Theme> {
  const tokens = sectionVisualTokens(section);
  return {
    "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.border },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: tokens.accent },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: tokens.focusRing, borderWidth: 2 },
    "&.Mui-focused": { boxShadow: `0 0 0 3px ${tokens.subtleBackground}` },
    "&.Mui-disabled": { backgroundColor: tokens.disabledBackground, color: tokens.disabledForeground }
  };
}

function optionSx(section: string | null | undefined): SxProps<Theme> {
  const tokens = sectionVisualTokens(section);
  return {
    gap: 1,
    backgroundColor: tokens.subtleBackground,
    color: tokens.foreground,
    "&:hover": { backgroundColor: tokens.hoverBackground },
    "&.Mui-selected": {
      backgroundColor: tokens.selectedBackground,
      color: tokens.foreground,
      "&:hover": { backgroundColor: tokens.hoverBackground }
    },
    "&.Mui-disabled": { backgroundColor: tokens.disabledBackground, color: tokens.disabledForeground },
    "&:focus-visible": { outline: `3px solid ${tokens.focusRing}`, outlineOffset: -3 }
  };
}

export function sectionCardSx(section: string | null | undefined) {
  const tokens = sectionVisualTokens(section);
  return {
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: tokens.accent,
    "&:focus-visible": { outline: `3px solid ${tokens.focusRing}`, outlineOffset: 2 }
  };
}

export function SectionOptionLabel({ section, label }: { section: string | null | undefined; label?: ReactNode }) {
  const tokens = sectionVisualTokens(section);
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      <Box
        component="span"
        aria-hidden="true"
        data-testid={tokens.section ? `section-swatch-${tokens.section.toLowerCase()}` : undefined}
        sx={{ width: 10, height: 10, borderRadius: "50%", flex: "0 0 auto", backgroundColor: tokens.accent, border: "1px solid", borderColor: tokens.border }}
      />
      <Box component="span" sx={{ minWidth: 0 }}>{label ?? section ?? "All sections"}</Box>
    </Box>
  );
}

export function SectionIdentityChip({ section, size = "small", ...props }: { section: string | null | undefined; size?: ChipProps["size"] } & Omit<ChipProps, "label" | "size" | "color">) {
  const tokens = sectionVisualTokens(section);
  const label = section?.trim() || "No section";
  return (
    <Chip
      {...props}
      size={size}
      variant="outlined"
      label={<SectionOptionLabel section={section} label={label} />}
      data-section={tokens.section ?? "other"}
      sx={[
        { borderColor: tokens.border, backgroundColor: tokens.subtleBackground, color: tokens.foreground, fontWeight: 700 },
        ...(Array.isArray(props.sx) ? props.sx : props.sx ? [props.sx] : [])
      ]}
    />
  );
}

type SectionOption = string | { value: string; label: ReactNode };

type SectionSelectProps = {
  id: string;
  label: string;
  value: string;
  options: readonly SectionOption[];
  onChange: (event: SelectChangeEvent<string>) => void;
  allValue?: string;
  allLabel?: ReactNode;
  size?: SelectProps<string>["size"];
  disabled?: boolean;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
};

export function SectionSelect({ id, label, value, options, onChange, allValue, allLabel = "All sections", size, disabled, fullWidth, sx }: SectionSelectProps) {
  const labelId = `${id}-label`;
  const selectedTokens = sectionVisualTokens(value === allValue ? null : value);
  const normalizedOptions = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
  return (
    <FormControl size={size} disabled={disabled} fullWidth={fullWidth} sx={sx}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        id={id}
        labelId={labelId}
        label={label}
        value={value}
        onChange={onChange}
        data-section={selectedTokens.section ?? "all"}
        renderValue={(selected) => (
          <SectionOptionLabel
            section={selected === allValue ? null : selected}
            label={selected === allValue ? allLabel : normalizedOptions.find((option) => option.value === selected)?.label ?? selected}
          />
        )}
        sx={sectionControlSx(value === allValue ? null : value)}
      >
        {allValue !== undefined && (
          <MenuItem value={allValue} sx={optionSx(null)}>
            <SectionOptionLabel section={null} label={allLabel} />
          </MenuItem>
        )}
        {normalizedOptions.filter((option) => option.value !== allValue).map((option) => (
          <MenuItem key={option.value} value={option.value} data-section={sectionVisualTokens(option.value).section ?? "other"} sx={optionSx(option.value)}>
            <SectionOptionLabel section={option.value} label={option.label} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

type SectionToggleButtonProps = Omit<ButtonProps, "color" | "variant"> & {
  section: string;
  selected: boolean;
};

export function SectionToggleButton({ section, selected, sx, children, ...props }: SectionToggleButtonProps) {
  const tokens = sectionVisualTokens(section);
  return (
    <Button
      {...props}
      variant="outlined"
      aria-pressed={selected}
      data-section={tokens.section ?? "other"}
      sx={[
        {
          borderColor: selected ? tokens.accent : tokens.border,
          borderWidth: selected ? 2 : 1,
          backgroundColor: selected ? tokens.selectedBackground : tokens.subtleBackground,
          color: tokens.foreground,
          "&:hover": { borderColor: tokens.accent, backgroundColor: tokens.hoverBackground, borderWidth: selected ? 2 : 1 },
          "&:focus-visible": { outline: `3px solid ${tokens.focusRing}`, outlineOffset: 2 },
          "&.Mui-disabled": { backgroundColor: tokens.disabledBackground, color: tokens.disabledForeground, borderColor: tokens.border }
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
    >
      <SectionOptionLabel section={section} label={children ?? section} />
    </Button>
  );
}
