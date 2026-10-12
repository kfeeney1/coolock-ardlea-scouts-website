import type { ReactNode } from "react";
import { Button } from "@mui/material";
import type { ButtonProps } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { To } from "react-router-dom";

type SharedProps = {
  children: ReactNode;
  color?: ButtonProps["color"];
  size?: ButtonProps["size"];
  sx?: ButtonProps["sx"];
  target?: string;
  rel?: string;
  download?: string | boolean;
  "aria-label"?: string;
};

type InternalProps = SharedProps & { to: To; href?: never };
type ExternalProps = SharedProps & { href: string; to?: never };

/** Navigation presented as a visible control while retaining native anchor semantics. */
export default function ActionLinkButton(props: InternalProps | ExternalProps) {
  const { children, color = "secondary", size = "medium", sx, ...destination } = props;
  const controlSx = [{ minHeight: 44, maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere" }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])];

  if ("to" in destination && destination.to) {
    const { to, target, rel, download, ...rest } = destination;
    return <Button component={RouterLink} to={to} target={target} rel={rel} download={download} color={color} size={size} variant="outlined" sx={controlSx} {...rest}>{children}</Button>;
  }

  const { href, target, rel, download, ...rest } = destination as ExternalProps;
  return <Button component="a" href={href} target={target} rel={rel} download={download} color={color} size={size} variant="outlined" sx={controlSx} {...rest}>{children}</Button>;
}
