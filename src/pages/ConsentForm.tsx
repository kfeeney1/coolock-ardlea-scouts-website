import {
    Alert,
    Box,
    Button,
    Container,
    Paper,
    Typography
} from "@mui/material";
import { useState } from "react";

import YouthConsentForm from "../components/consent/YouthConsentForm";
import ScouterConsentForm from "../components/consent/ScouterConsentForm";
import { brandColours } from "../theme/theme";
import type {
    ScoutSection,
    YouthScoutSection
} from "../services/consentApplications";

const sectionOptions: Array<{
    value: ScoutSection;
    label: string;
    ages: string;
    icon: string;
}> = [
    {
        value: "Beavers",
        label: "Beavers",
        ages: "Ages 6–9",
        icon: "🦫"
    },
    {
        value: "Cubs",
        label: "Cubs",
        ages: "Ages 9–12",
        icon: "🐯"
    },
    {
        value: "Scouts",
        label: "Scouts",
        ages: "Ages 12–15",
        icon: "⚜️"
    },
    {
        value: "Ventures",
        label: "Ventures",
        ages: "Ages 15–18",
        icon: "🧭"
    },
    {
        value: "Rovers",
        label: "Rovers",
        ages: "Ages 18–26",
        icon: "🌍"
    },
    {
        value: "Scouter",
        label: "Scouter",
        ages: "18+ ES3",
        icon: "👤"
    }
];

export default function ConsentForm() {
    const [section, setSection] =
        useState<ScoutSection | null>(null);

    if (section === "Scouter") {
        return (
            <Box
                sx={{
                    minHeight: "100vh",
                    backgroundColor:
                        "background.default",
                    py: {
                        xs: 4,
                        md: 7
                    }
                }}
            >
                <Container maxWidth="md">
                    <ScouterConsentForm
                        onChangeSection={() =>
                            setSection(null)
                        }
                    />
                </Container>
            </Box>
        );
    }

    if (section) {
        return (
            <Box
                sx={{
                    minHeight: "100vh",
                    backgroundColor:
                        "background.default",
                    py: {
                        xs: 4,
                        md: 7
                    }
                }}
            >
                <Container maxWidth="md">
                    <YouthConsentForm
                        section={
                            section as YouthScoutSection
                        }
                        onChangeSection={() =>
                            setSection(null)
                        }
                    />
                </Container>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: "100vh",
                backgroundColor: "background.default",
                py: {
                    xs: 4,
                    md: 7
                }
            }}
        >
            <Container maxWidth="lg">
                <Paper
                    elevation={4}
                    sx={{ overflow: "hidden" }}
                >
                    <Box
                        sx={{
                            background: `linear-gradient(
                                135deg,
                                ${brandColours.coral},
                                ${brandColours.navy}
                            )`,
                            color: "white",
                            p: {
                                xs: 3,
                                md: 5
                            },
                            textAlign: "center"
                        }}
                    >
                        <Typography
                            variant="h3"
                            component="h1"
                        >
                            Scouting Ireland Consent Forms
                        </Typography>

                        <Typography
                            variant="h6"
                            sx={{ mt: 1.5 }}
                        >
                            80th 160th Coolock Ardlea Scout Group
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            p: {
                                xs: 3,
                                md: 5
                            }
                        }}
                    >
                        <Typography
                            variant="h4"
                            color="secondary"
                            sx={{
                                textAlign: "center"
                            }}
                        >
                            Choose a Section
                        </Typography>

                        <Typography
                            sx={{
                                mt: 1.5,
                                mb: 4,
                                textAlign: "center",
                                color: "text.secondary"
                            }}
                        >
                            Youth sections use the Activities
                            Consent Form. Scouters use the ES3
                            18+ Medical Advice Form.
                        </Typography>

                        <Alert
                            severity="info"
                            sx={{ mb: 4 }}
                        >
                            The Managing Medications SIF 20/10
                            section is available within both form
                            types when required.
                        </Alert>

                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "1fr 1fr",
                                    md: "repeat(3, 1fr)"
                                },
                                gap: 2
                            }}
                        >
                            {sectionOptions.map(
                                (option) => (
                                    <Button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            setSection(
                                                option.value
                                            )
                                        }
                                        sx={{
                                            p: 0,
                                            display: "block",
                                            textAlign: "left",
                                            borderRadius: 3,
                                            textTransform:
                                                "none"
                                        }}
                                    >
                                        <Paper
                                            variant="outlined"
                                            sx={{
                                                p: 3,
                                                height: "100%",
                                                textAlign:
                                                    "center",
                                                border: "2px solid",
                                                borderColor:
                                                    "divider",
                                                transition:
                                                    "0.2s",
                                                "&:hover": {
                                                    borderColor:
                                                        "primary.main",
                                                    backgroundColor:
                                                        option.value ===
                                                        "Scouter"
                                                            ? brandColours.navyLight
                                                            : brandColours.coralLight
                                                }
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontSize:
                                                        "2rem"
                                                }}
                                            >
                                                {option.icon}
                                            </Typography>

                                            <Typography
                                                variant="h6"
                                                color="secondary"
                                                sx={{ mt: 1 }}
                                            >
                                                {
                                                    option.label
                                                }
                                            </Typography>

                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                {option.ages}
                                            </Typography>
                                        </Paper>
                                    </Button>
                                )
                            )}
                        </Box>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
