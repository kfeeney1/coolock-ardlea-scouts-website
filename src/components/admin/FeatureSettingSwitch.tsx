import { FormControlLabel, Switch } from "@mui/material";

type Props = {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

export default function FeatureSettingSwitch({ label, checked, disabled, onChange }: Props) {
  return (
    <FormControlLabel
      label={label}
      sx={{ minHeight: 44, mx: 0 }}
      control={
        <Switch
          color="secondary"
          checked={checked}
          disabled={disabled}
          onChange={(_, enabled) => onChange(enabled)}
          slotProps={{ input: { role: "switch" } }}
          sx={{
            minHeight: 44,
            py: "15px",
            "& .MuiSwitch-switchBase": { minHeight: 44 },
            "& .MuiSwitch-input:focus-visible + .MuiSwitch-thumb": {
              outline: "3px solid",
              outlineColor: "text.primary",
              outlineOffset: 3,
            },
          }}
        />
      }
    />
  );
}
