import { createTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import type { ThemeName } from "./themePreferences";

export const brandColours = {
  coral: "#F52D45",
  coralLight: "#FDE8EC",
  navy: "#081E67",
  navyLight: "#EEF1FA",
  green: "#00B050",
  greenDark: "#00853B",
  page: "#F8F9FA",
  white: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280"
} as const;

export const defaultTheme = createTheme({
  palette: {
    primary: { main: brandColours.coral, contrastText: brandColours.white },
    secondary: { main: brandColours.navy, contrastText: brandColours.white },
    success: { main: brandColours.green, dark: brandColours.greenDark, contrastText: brandColours.white },
    background: { default: brandColours.page, paper: brandColours.white },
    text: { primary: brandColours.text, secondary: brandColours.muted }
  },
  typography: {
    fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontWeight: 800 }, h2: { fontWeight: 800 }, h3: { fontWeight: 800 },
    h4: { fontWeight: 700 }, h5: { fontWeight: 700 }, button: { fontWeight: 700 }
  },
  shape: { borderRadius: 14 },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: "999px", textTransform: "none", paddingLeft: "24px", paddingRight: "24px" } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: "18px" } } },
    MuiCard: { styleOverrides: { root: { borderRadius: "18px" } } }
  }
});

export const modernTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#3155E7", contrastText: "#FFFFFF" },
    secondary: { main: "#0E7490", contrastText: "#FFFFFF" },
    success: { main: "#15803D" },
    background: { default: "#F3F6FB", paper: "#FFFFFF" },
    text: { primary: "#172033", secondary: "#667085" },
    divider: "#DCE3EF"
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontWeight: 750, letterSpacing: "-0.035em" },
    h2: { fontWeight: 750, letterSpacing: "-0.025em" },
    h3: { fontWeight: 700, letterSpacing: "-0.02em" },
    h4: { fontWeight: 700 }, h5: { fontWeight: 700 }, button: { fontWeight: 700 }
  },
  shape: { borderRadius: 18 },
  components: {
    MuiAppBar: { styleOverrides: { root: { boxShadow: "0 1px 0 rgba(23,32,51,0.08)", backgroundImage: "none" } } },
    MuiButton: { styleOverrides: { root: { borderRadius: "12px", textTransform: "none", minHeight: "42px", paddingLeft: "20px", paddingRight: "20px", boxShadow: "none" } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: "20px" }, root: { backgroundImage: "none" } } },
    MuiCard: { styleOverrides: { root: { borderRadius: "20px", border: "1px solid #E3E8F2", boxShadow: "0 8px 30px rgba(23,32,51,0.06)" } } },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: "12px" } } },
    MuiChip: { styleOverrides: { root: { borderRadius: "10px", fontWeight: 650 } } }
  }
});

export function themeForName(name: ThemeName): Theme {
  return name === "modern" ? modernTheme : defaultTheme;
}

export default defaultTheme;
