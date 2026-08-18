import { createTheme } from "@mui/material/styles";

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

const theme = createTheme({
    palette: {
        primary: {
            main: brandColours.coral,
            contrastText: brandColours.white
        },
        secondary: {
            main: brandColours.navy,
            contrastText: brandColours.white
        },
        success: {
            main: brandColours.green,
            dark: brandColours.greenDark,
            contrastText: brandColours.white
        },
        background: {
            default: brandColours.page,
            paper: brandColours.white
        },
        text: {
            primary: brandColours.text,
            secondary: brandColours.muted
        }
    },

    typography: {
        fontFamily:
            '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',

        h1: {
            fontWeight: 800
        },

        h2: {
            fontWeight: 800
        },

        h3: {
            fontWeight: 800
        },

        h4: {
            fontWeight: 700
        },

        h5: {
            fontWeight: 700
        },

        button: {
            fontWeight: 700
        }
    },

    shape: {
        borderRadius: 14
    },

    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: "999px",
                    textTransform: "none",
                    paddingLeft: "24px",
                    paddingRight: "24px"
                }
            }
        },

        MuiPaper: {
            styleOverrides: {
                rounded: {
                    borderRadius: "18px"
                }
            }
        },

        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: "18px"
                }
            }
        }
    }
});

export default theme;
