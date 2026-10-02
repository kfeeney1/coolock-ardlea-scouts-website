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

const meetingTimes = [
    { section: "Beavers", schedule: "Wednesday, 6:30 pm–8:00 pm" },
    { section: "Cubs", schedule: "Tuesday, 7:00 pm–8:30 pm" },
    { section: "Scouts", schedule: "Wednesday, 8:00 pm–9:30 pm" },
    { section: "Ventures", schedule: "Tuesday, 8:30 pm–10:00 pm" }
] as const;

const googleMapsUrl = "https://maps.app.goo.gl/iexSS8BtsViUA2D87?g_st=ac";

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
                data-theme-surface="hero"
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
                    <Box data-theme-surface="hero-content"
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
                        </Box>
                    </Box>
                </Container>
            </Box>

            <Box component="section" aria-labelledby="meeting-times-heading" sx={{ py: { xs: 6, md: 8 } }}>
                <Container maxWidth="lg">
                    <Typography id="meeting-times-heading" variant="h3" component="h2" color="secondary" sx={{ textAlign: "center", mb: 4 }}>
                        Meeting Times
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2 }}>
                        {meetingTimes.map(({ section, schedule }) => (
                            <Paper key={section} elevation={2} sx={{ p: 3, borderTop: `5px solid ${brandColours.coral}` }}>
                                <Typography variant="h5" component="h3" color="secondary" sx={{ mb: 1 }}>
                                    {section}
                                </Typography>
                                <Typography>{schedule}</Typography>
                            </Paper>
                        ))}
                    </Box>
                </Container>
            </Box>

            <Box component="section" aria-labelledby="where-we-meet-heading" sx={{ backgroundColor: "background.default", py: { xs: 6, md: 8 } }}>
                <Container maxWidth="lg">
                    <Paper elevation={1} sx={{ p: { xs: 3, md: 5 }, textAlign: "center" }}>
                        <Typography id="where-we-meet-heading" variant="h3" component="h2" color="secondary" sx={{ mb: 2 }}>
                            Where We Meet
                        </Typography>
                        <Typography sx={{ mb: 3, color: "text.secondary" }}>
                            View our meeting location on Google Maps.
                        </Typography>
                        <Button
                            component="a"
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="contained"
                            color="primary"
                        >
                            View on Google Maps
                        </Button>
                    </Paper>
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

                    <Box data-theme-surface="feature-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3 }}>
                        {content.home.featureCards.map((feature) => (
                            <Paper
                                key={feature.title}
                                data-theme-surface="feature-card"
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
