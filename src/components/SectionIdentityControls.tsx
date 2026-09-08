import { Box, Button, Chip, FormControl, InputLabel, MenuItem, type ButtonProps, type ChipProps } from "@mui/material";
import Select, { type SelectChangeEvent, type SelectProps } from "@mui/material/Select";
import type { SxProps, Theme } from "@mui/material/styles";
import { useEffect, useRef, useState, type ReactNode } from "react";

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
    backgroundColor: "transparent",
    color: "text.primary",
    "&:hover": { backgroundColor: "action.hover" },
    "&.Mui-selected": {
      backgroundColor: "action.selected",
      color: "text.primary",
      "&:hover": { backgroundColor: "action.hover" }
    },
    "&.Mui-disabled": { backgroundColor: "action.disabledBackground", color: "text.disabled" },
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

type MenuPlacement = {
  anchorVertical: "top" | "bottom";
  transformVertical: "top" | "bottom";
  maxHeight: number;
};

const DEFAULT_MENU_PLACEMENT: MenuPlacement = {
  anchorVertical: "bottom",
  transformVertical: "top",
  maxHeight: 320
};

export function SectionSelect({ id, label, value, options, onChange, allValue, allLabel = "All sections", size, disabled, fullWidth, sx }: SectionSelectProps) {
  const labelId = `${id}-label`;
  const selectedTokens = sectionVisualTokens(value === allValue ? null : value);
  const normalizedOptions = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement>(DEFAULT_MENU_PLACEMENT);
  const [menuOpen, setMenuOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const openScroll = useRef({ x: 0, y: 0 });
  const closeFromScroll = useRef(false);

  const getTrigger = () => controlRef.current?.querySelector<HTMLElement>('[role="combobox"]') ?? document.getElementById(id);

  const handleOpen = () => {
    const trigger = getTrigger();
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportMargin = 16;
    const spaceBelow = window.innerHeight - rect.bottom - viewportMargin;
    const spaceAbove = rect.top - viewportMargin;
    const openAbove = spaceAbove > spaceBelow;
    const availableSpace = Math.max(openAbove ? spaceAbove : spaceBelow, 0);

    window.scrollTo(openScroll.current.x, openScroll.current.y);
    setMenuPlacement({
      anchorVertical: openAbove ? "top" : "bottom",
      transformVertical: openAbove ? "bottom" : "top",
      maxHeight: Math.max(Math.min(320, availableSpace), 48)
    });
    closeFromScroll.current = false;
    setMenuOpen(true);
  };

  const captureOpen = () => {
    openScroll.current = { x: window.scrollX, y: window.scrollY };
  };

  const handleClose = () => {
    setMenuOpen(false);
    if (!closeFromScroll.current) {
      getTrigger()?.focus({ preventScroll: true });
      window.scrollTo(openScroll.current.x, openScroll.current.y);
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const dismissDetachedMenu = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[role="listbox"]')) return;
      closeFromScroll.current = true;
      setMenuOpen(false);
    };
    window.addEventListener("scroll", dismissDetachedMenu, true);
    return () => window.removeEventListener("scroll", dismissDetachedMenu, true);
  }, [menuOpen]);

  return (
    <FormControl ref={controlRef} size={size} disabled={disabled} fullWidth={fullWidth} sx={sx}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        id={id}
        labelId={labelId}
        label={label}
        value={value}
        open={menuOpen}
        onChange={onChange}
        onMouseDownCapture={captureOpen}
        onKeyDownCapture={captureOpen}
        onOpen={handleOpen}
        onClose={handleClose}
        data-section={selectedTokens.section ?? "all"}
        MenuProps={{
          anchorEl: getTrigger,
          anchorOrigin: { vertical: menuPlacement.anchorVertical, horizontal: "left" },
          transformOrigin: { vertical: menuPlacement.transformVertical, horizontal: "left" },
          marginThreshold: 0,
          disableScrollLock: true,
          disableRestoreFocus: true,
          slotProps: {
            paper: {
              sx: {
                maxHeight: `${menuPlacement.maxHeight}px`
              }
            }
          }
        }}
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
