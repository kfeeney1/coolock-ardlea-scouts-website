import { useEffect, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";

import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { themeForName } from "./theme";
import { normalizeThemePreference } from "./themePreferences";

type Props = { children: ReactNode };

export default function ThemeExperienceProvider({ children }: Props) {
  const { adminProfile } = useAdminAuth();
  const themeName = normalizeThemePreference(adminProfile?.uiTheme);

  useEffect(() => {
    document.documentElement.dataset.uiTheme = themeName;
    return () => {
      delete document.documentElement.dataset.uiTheme;
    };
  }, [themeName]);

  return <ThemeProvider theme={themeForName(themeName)}>{children}</ThemeProvider>;
}
