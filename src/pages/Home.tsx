import {
    Box,
    Button,
    Container,
    Paper,
    Typography
} from "@mui/material";
import { Link } from "react-router-dom";

import { brandColours } from "../theme/theme";

const featureCards = [
    {
        title: "Adventure",
        description:
            "Take part in camps, hikes, outdoor challenges and unforgettable experiences.",
        accent: brandColours.coralLight
    },
    {
        title: "Learn Skills",
        description:
            "Build confidence, teamwork, leadership and practical life skills through Scouting.",
        accent: brandColours.navyLight
    },
    {
        title: "Community",
        description:
            "Make friends, help others and become part of a welcoming local Scout community.",
        accent: "#EAF8EF"
    }
];

export default function Home() {
    return (
        <Box>
            <Box
                sx={{
                    background: `linear-gradient(
                        135deg,
                        ${brandColours.coral} 0%,
                        ${brandColours.navy} 100%
                    )`,
                    color: "white",
                    py: {
                        xs: 8,
                        md: 12
                    }
                }}
            >
                <Container maxWidth="lg">
                    <Box
                        sx={{
                            maxWidth: 820,
                            mx: "auto",
                            textAlign: "center"
                        }}
                    >
                        <Typography
                            variant="h5"
                            component="p"
                            sx={{
                                mb: 2,
                                fontWeight: 600
                            }}
                        >
                            Welcome to
                        </Typography>

                        <Typography
                            variant="h2"
                            component="h1"
                            sx={{
                                fontWeight: 800,
                                fontSize: {
                                    xs: "2.35rem",
                                    sm: "3.35rem",
                                    md: "4.15rem"
                                }
                            }}
                        >
                            80th 160th Coolock Ardlea Scout Group
                        </Typography>

                        <Typography
                            variant="h5"
                            component="p"
                            sx={{
                                mt: 3,
                                fontWeight: 500
                            }}
                        >
                            Adventure • Skills • Community
                        </Typography>

                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: {
                                    xs: "column",
                                    sm: "row"
                                },
                                justifyContent: "center",
                                gap: 2,
                                mt: 5
                            }}
                        >
                            <Button
                                component={Link}
                                to="/join"
                                variant="contained"
                                color="success"
                                size="large"
                                sx={{
                                    py: 1.5,
                                    minWidth: 180
                                }}
                            >
                                Join Us
                            </Button>

                            <Button
                                component={Link}
                                to="/activities/consent"
                                variant="outlined"
                                size="large"
                                sx={{
                                    py: 1.5,
                                    minWidth: 220,
                                    color: "white",
                                    borderColor: "white",
                                    "&:hover": {
                                        borderColor: "white",
                                        backgroundColor:
                                            "rgba(255,255,255,0.12)"
                                    }
                                }}
                            >
                                Activity Consent
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            <Box
                sx={{
                    backgroundColor: "background.default",
                    py: {
                        xs: 6,
                        md: 9
                    }
                }}
            >
                <Container maxWidth="lg">
                    <Typography
                        variant="h3"
                        component="h2"
                        color="secondary"
                        sx={{
                            textAlign: "center",
                            mb: 2
                        }}
                    >
                        Discover Scouting
                    </Typography>

                    <Typography
                        sx={{
                            textAlign: "center",
                            maxWidth: 720,
                            mx: "auto",
                            mb: 5,
                            color: "text.secondary"
                        }}
                    >
                        Scouting gives young people the chance to
                        explore, learn, make friends and play an
                        active part in their community.
                    </Typography>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                md: "repeat(3, 1fr)"
                            },
                            gap: 3
                        }}
                    >
                        {featureCards.map((feature) => (
                            <Paper
                                key={feature.title}
                                elevation={2}
                                sx={{
                                    p: 4,
                                    height: "100%",
                                    borderTop: `6px solid ${brandColours.coral}`,
                                    backgroundColor: feature.accent
                                }}
                            >
                                <Typography
                                    variant="h5"
                                    component="h3"
                                    color="secondary"
                                    sx={{ mb: 2 }}
                                >
                                    {feature.title}
                                </Typography>

                                <Typography
                                    sx={{
                                        lineHeight: 1.8
                                    }}
                                >
                                    {feature.description}
                                </Typography>
                            </Paper>
                        ))}
                    </Box>
                </Container>
            </Box>
        </Box>
    );
}
