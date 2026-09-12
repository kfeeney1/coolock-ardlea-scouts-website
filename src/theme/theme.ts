import { createTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import StableSelect from "../components/StableSelect";
import { controlColours } from "./controlColours";
import type { ThemeName } from "./themePreferences";

export const brandColours = {
  coral: "#F52D45",
  coralControl: controlColours.default.primary.background,
  coralLight: "#FDE8EC",
  navy: controlColours.default.secondary.background,
  navyLight: "#EEF1FA",
  green: "#00B050",
  greenDark: controlColours.default.success.background,
  page: "#F8F9FA",
  white: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280"
} as const;

const responsiveDialogActions = {
  styleOverrides: {
    root: ({ theme }: { theme: Theme }) => ({
      [theme.breakpoints.down("sm")]: {
        alignItems: "stretch",
        flexDirection: "column-reverse",
        padding: theme.spacing(2),
        "& > :not(style) ~ :not(style)": { marginLeft: 0, marginBottom: theme.spacing(1) },
        "& .MuiButton-root": { width: "100%" }
      }
    })
  }
} as const;

const stableTransientPopovers = {
  defaultProps: { disableScrollLock: true }
} as const;

const stableTextFieldSelect = {
  defaultProps: { slots: { select: StableSelect } }
} as const;

export const defaultTheme = createTheme({
  palette: {
    primary: { main: controlColours.default.primary.background, contrastText: controlColours.default.primary.foreground },
    secondary: { main: controlColours.default.secondary.background, contrastText: controlColours.default.secondary.foreground },
    success: { main: controlColours.default.success.background, dark: controlColours.default.success.background, contrastText: controlColours.default.success.foreground },
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
    MuiDialogActions: responsiveDialogActions,
    MuiPopover: stableTransientPopovers,
    MuiTextField: stableTextFieldSelect,
    MuiPaper: { styleOverrides: { rounded: { borderRadius: "18px" } } },
    MuiCard: { styleOverrides: { root: { borderRadius: "18px" } } }
  }
});

export const modernTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: controlColours.modern.primary.background, contrastText: controlColours.modern.primary.foreground },
    secondary: { main: controlColours.modern.secondary.background, contrastText: controlColours.modern.secondary.foreground },
    success: { main: controlColours.modern.success.background, contrastText: controlColours.modern.success.foreground },
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
    MuiDialogActions: responsiveDialogActions,
    MuiPopover: stableTransientPopovers,
    MuiPaper: { styleOverrides: { rounded: { borderRadius: "20px" }, root: { backgroundImage: "none" } } },
    MuiCard: { styleOverrides: { root: { borderRadius: "20px", border: "1px solid #E3E8F2", boxShadow: "0 8px 30px rgba(23,32,51,0.06)" } } },
    MuiTextField: { defaultProps: { variant: "outlined", slots: { select: StableSelect } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: "12px" } } },
    MuiChip: { styleOverrides: { root: { borderRadius: "10px", fontWeight: 650 } } }
  }
});

export function themeForName(name: ThemeName): Theme {
  return name === "modern" ? modernTheme : defaultTheme;
}

export {
  NEUTRAL_SECTION_VISUAL_TOKENS,
  SECTION_VISUAL_TOKENS,
  resolveScoutSectionName,
  sectionVisualTokens,
  type ScoutSectionName,
  type SectionVisualTokens
} from "./sectionColours";

export default defaultTheme;