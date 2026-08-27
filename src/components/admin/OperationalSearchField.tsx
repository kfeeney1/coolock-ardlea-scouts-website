import SearchIcon from "@mui/icons-material/Search";
import { InputAdornment, TextField } from "@mui/material";

type Props = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    testId?: string;
};

export default function OperationalSearchField({
    label,
    value,
    onChange,
    placeholder,
    testId
}: Props) {
    return (
        <TextField
            fullWidth
            label={label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            slotProps={{
                input: {
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                        </InputAdornment>
                    )
                },
                htmlInput: testId ? { "data-testid": testId } : undefined
            }}
        />
    );
}
