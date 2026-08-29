import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";

import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { themeForName } from "./theme";
import { normalizeThemePreference, type ThemeName } from "./themePreferences";

const THEME_CACHE_KEY = "coolock-ardlea-ui-theme";

type Props = { children: ReactNode };

function cachedTheme(): ThemeName {
  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_CACHE_KEY));
  } catch {
    return "default";
  }
}

export default function ThemeExperienceProvider({ children }: Props) {
  const { adminProfile, loading } = useAdminAuth();
  const [themeName, setThemeName] = useState<ThemeName>(cachedTheme);

  useEffect(() => {
    if (loading) return;

    const nextTheme = normalizeThemePreference(adminProfile?.uiTheme);
    setThemeName(nextTheme);
    try {
      if (adminProfile) window.localStorage.setItem(THEME_CACHE_KEY, nextTheme);
      else window.localStorage.removeItem(THEME_CACHE_KEY);
    } catch {
      // Storage can be unavailable in restricted browsing modes.
    }
  }, [adminProfile, loading]);

  useEffect(() => {
    document.documentElement.dataset.uiTheme = themeName;
    return () => {
      delete document.documentElement.dataset.uiTheme;
    };
  }, [themeName]);

  return <ThemeProvider theme={themeForName(themeName)}>{children}</ThemeProvider>;
}
