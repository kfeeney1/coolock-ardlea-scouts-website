import { Chip } from "@mui/material";

type Tone = "default" | "success" | "warning" | "error" | "info";

type Props = {
    label: string;
    tone?: Tone;
    variant?: "filled" | "outlined";
};

export default function OperationalStatusChip({
    label,
    tone = "default",
    variant = "filled"
}: Props) {
    return (
        <Chip
            size="small"
            label={label}
            color={tone}
            variant={variant}
        />
    );
}
