import {
    Box,
    Button,
    Container,
    Paper,
    Typography
} from "@mui/material";
import { Link } from "react-router-dom";

import { brandColours } from "../theme/theme";
import { usePublicSiteContent } from "../components/PublicSiteContentProvider";

export default function Home() {
    const content = usePublicSiteContent();
    const accent = {
        coralLight: brandColours.coralLight,
        navyLight: brandColours.navyLight,
        communityLight: "#EAF8EF"
    } as const;

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
                        <Typography variant="h5" component="p" sx={{ mb: 2, fontWeight: 600 }}>
                            {content.home.eyebrow}
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
                            {content.group.name}
                        </Typography>

                        <Typography variant="h5" component="p" sx={{ mt: 3, fontWeight: 500 }}>
                            {content.home.tagline}
                        </Typography>

                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: { xs: "column", sm: "row" },
                                justifyContent: "center",
                                gap: 2,
                                mt: 5
                            }}
                        >
                            <Button component={Link} to="/join" variant="contained" color="success" size="large" sx={{ py: 1.5, minWidth: 180 }}>
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
                                    "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.12)" }
                                }}
                            >
                                Activity Consent
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            <Box sx={{ backgroundColor: "background.default", py: { xs: 6, md: 9 } }}>
                <Container maxWidth="lg">
                    <Typography variant="h3" component="h2" color="secondary" sx={{ textAlign: "center", mb: 2 }}>
                        {content.home.discoverTitle}
                    </Typography>
                    <Typography sx={{ textAlign: "center", maxWidth: 720, mx: "auto", mb: 5, color: "text.secondary" }}>
                        {content.home.discoverIntro}
                    </Typography>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3 }}>
                        {content.home.featureCards.map((feature) => (
                            <Paper
                                key={feature.title}
                                elevation={2}
                                sx={{
                                    p: 4,
                                    height: "100%",
                                    borderTop: `6px solid ${brandColours.coral}`,
                                    backgroundColor: accent[feature.accent]
                                }}
                            >
                                <Typography variant="h5" component="h3" color="secondary" sx={{ mb: 2 }}>
                                    {feature.title}
                                </Typography>
                                <Typography sx={{ lineHeight: 1.8 }}>{feature.description}</Typography>
                            </Paper>
                        ))}
                    </Box>
                </Container>
            </Box>
        </Box>
    );
}
