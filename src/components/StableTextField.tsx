import TextField, { type TextFieldProps } from "@mui/material/TextField";

import StableSelect from "./StableSelect";

/**
 * Keeps ordinary TextField behaviour unchanged while ensuring `select`
 * TextFields use the same stable popup implementation as site-wide Selects.
 */
export default function StableTextField(props: TextFieldProps) {
  const { slots, ...rest } = props;
  return (
    <TextField
      {...rest}
      slots={props.select ? { ...slots, select: StableSelect } : slots}
    />
  );
}
