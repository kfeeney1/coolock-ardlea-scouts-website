import {
    FormControl,
    FormControlLabel,
    FormHelperText,
    Radio,
    RadioGroup,
    Typography
} from "@mui/material";

import type {
    YesNo
} from "../../services/consentApplications";

type Props = {
    label: string;
    value: YesNo | "";
    error?: string;
    onChange: (value: YesNo) => void;
};

export default function YesNoField({
    label,
    value,
    error,
    onChange
}: Props) {
    return (
        <FormControl
            error={Boolean(error)}
            sx={{
                width: "100%",
                p: 2,
                border: "1px solid",
                borderColor: error
                    ? "error.main"
                    : "divider",
                borderRadius: 2,
                backgroundColor: "background.paper"
            }}
        >
            <Typography sx={{ fontWeight: 600 }}>
                {label}
            </Typography>

            <RadioGroup
                row
                value={value}
                onChange={(event) =>
                    onChange(
                        event.target.value as YesNo
                    )
                }
                sx={{ mt: 0.5 }}
            >
                <FormControlLabel
                    value="Yes"
                    control={<Radio color="success" />}
                    label="Yes"
                />
                <FormControlLabel
                    value="No"
                    control={<Radio />}
                    label="No"
                />
            </RadioGroup>

            {error && (
                <FormHelperText>{error}</FormHelperText>
            )}
        </FormControl>
    );
}
