import { Button, Chip, Stack } from "@mui/material";

type Props = {
  mode: "overview" | "record";
  step: "members" | "badgework";
  onOverview: () => void;
  onRecord: () => void;
};

export default function BadgeworkModeNavigation({ mode, step, onOverview, onRecord }: Props) {
  return <>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
      <Button variant={mode === "overview" ? "contained" : "outlined"} color="secondary" onClick={onOverview}>Badgework Overview</Button>
      <Button variant={mode === "record" ? "contained" : "outlined"} color="success" onClick={onRecord}>Record badgework</Button>
    </Stack>
    {mode === "record" && <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }} useFlexGap>
      <Chip color={step === "members" ? "secondary" : "success"} label="1. Select members" />
      <Chip color={step === "badgework" ? "secondary" : "default"} label="2. Badgework & save" />
    </Stack>}
  </>;
}

