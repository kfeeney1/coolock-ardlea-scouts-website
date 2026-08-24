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
import { usePublicSiteContent } from "../components/PublicSiteContentProvider";
import type {
    ScoutSection,
    YouthScoutSection
} from "../services/consentApplications";

export default function ConsentForm() {
    const content = usePublicSiteContent();
    const sectionOptions = content.sections;
    const [section, setSection] = useState<ScoutSection | null>(null);

    if (section === "Scouter") {
        return (
            <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 } }}>
                <Container maxWidth="md">
                    <ScouterConsentForm onChangeSection={() => setSection(null)} />
                </Container>
            </Box>
        );
    }

    if (section) {
        return (
            <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 } }}>
                <Container maxWidth="md">
                    <YouthConsentForm section={section as YouthScoutSection} onChangeSection={() => setSection(null)} />
                </Container>
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 } }}>
            <Container maxWidth="lg">
                <Paper elevation={4} sx={{ overflow: "hidden" }}>
                    <Box
                        sx={{
                            background: `linear-gradient(135deg, ${brandColours.coral}, ${brandColours.navy})`,
                            color: "white",
                            p: { xs: 3, md: 5 },
                            textAlign: "center"
                        }}
                    >
                        <Typography variant="h3" component="h1">{content.consent.title}</Typography>
                        <Typography variant="h6" sx={{ mt: 1.5 }}>{content.group.name}</Typography>
                    </Box>

                    <Box sx={{ p: { xs: 3, md: 5 } }}>
                        <Typography variant="h4" color="secondary" sx={{ textAlign: "center" }}>
                            {content.consent.chooserTitle}
                        </Typography>
                        <Typography sx={{ mt: 1.5, mb: 4, textAlign: "center", color: "text.secondary" }}>
                            {content.consent.chooserIntro}
                        </Typography>
                        <Alert severity="info" sx={{ mb: 4 }}>{content.consent.medicationNotice}</Alert>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                            {sectionOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setSection(option.value as ScoutSection)}
                                    sx={{ p: 0, display: "block", textAlign: "left", borderRadius: 3, textTransform: "none" }}
                                >
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 3,
                                            height: "100%",
                                            textAlign: "center",
                                            border: "2px solid",
                                            borderColor: "divider",
                                            transition: "0.2s",
                                            "&:hover": {
                                                borderColor: "primary.main",
                                                backgroundColor: option.youth ? brandColours.coralLight : brandColours.navyLight
                                            }
                                        }}
                                    >
                                        <Typography sx={{ fontSize: "2rem" }}>{option.icon}</Typography>
                                        <Typography variant="h6" color="secondary" sx={{ mt: 1 }}>{option.label}</Typography>
                                        <Typography variant="body2" color="text.secondary">{option.ages}</Typography>
                                    </Paper>
                                </Button>
                            ))}
                        </Box>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
