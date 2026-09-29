import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { IconButton, InputAdornment, TextField, type TextFieldProps } from "@mui/material";
import { useState } from "react";

type Props = Omit<TextFieldProps, "type">;

export default function PasswordField(props: Props) {
  const [visible, setVisible] = useState(false);
  const action = visible ? "Hide characters" : "Show characters";
  const title = visible ? "Hide password" : "Show password";
  return <TextField
    {...props}
    type={visible ? "text" : "password"}
    slotProps={{
      ...props.slotProps,
      input: {
        ...props.slotProps?.input,
        endAdornment: <InputAdornment position="end">
          <IconButton
            edge="end"
            aria-label={action}
            aria-pressed={visible}
            title={title}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setVisible((current) => !current)}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            {visible ? <VisibilityOffIcon aria-hidden="true" /> : <VisibilityIcon aria-hidden="true" />}
          </IconButton>
        </InputAdornment>
      }
    }}
  />;
}
