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
import { brandColours } from "../theme/theme";
import { sectionVisualTokens } from "../theme/sectionColours";
import { usePublicSiteContent } from "../components/PublicSiteContentProvider";
import type {
    ScoutSection,
    YouthScoutSection
} from "../services/consentApplications";

const OFFICIAL_SECTION_SYMBOL_POSITION: Partial<Record<ScoutSection, string>> = {
    Beavers: "0% 50%",
    Cubs: "25% 50%",
    Scouts: "50% 50%",
    Ventures: "75% 50%",
    Rovers: "100% 50%"
};

function SectionSymbol({ section }: { section: ScoutSection }) {
    const position = OFFICIAL_SECTION_SYMBOL_POSITION[section];
    if (!position) return null;

    return (
        <Box
            aria-hidden="true"
            data-testid={`official-section-symbol-${section.toLowerCase()}`}
            sx={{
                width: 112,
                height: 106,
                mx: "auto",
                backgroundImage: "url('/scouting-ireland-one-programme-sections.webp')",
                backgroundRepeat: "no-repeat",
                backgroundSize: "500% 100%",
                backgroundPosition: position,
                borderRadius: 1
            }}
        />
    );
}

export default function ConsentForm() {
    const content = usePublicSiteContent();
    const sectionOptions = content.sections.filter((option) => option.youth);
    const [section, setSection] = useState<ScoutSection | null>(null);

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
                        <Typography sx={{ mt: 1.5, mb: 1, textAlign: "center", color: "text.secondary" }}>
                            {content.consent.chooserIntro}
                        </Typography>
                        <Typography sx={{ mb: 4, textAlign: "center", color: "text.secondary" }}>
                            Scouters can complete their confidential ES3 form from My Profile after signing in.
                        </Typography>
                        <Alert severity="info" sx={{ mb: 4 }}>{content.consent.medicationNotice}</Alert>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                            {sectionOptions.map((option) => {
                                const tokens = sectionVisualTokens(option.value);
                                return (
                                    <Button
                                        key={option.value}
                                        type="button"
                                        aria-label={`Open ${option.label} consent form`}
                                        onClick={() => setSection(option.value as ScoutSection)}
                                        sx={{
                                            p: 0,
                                            display: "block",
                                            textAlign: "left",
                                            borderRadius: 3,
                                            textTransform: "none",
                                            "&:focus-visible": { outline: `3px solid ${tokens.focusRing}`, outlineOffset: 3 }
                                        }}
                                    >
                                        <Paper
                                            variant="outlined"
                                            sx={{
                                                p: 3,
                                                height: "100%",
                                                textAlign: "center",
                                                border: "2px solid",
                                                borderColor: option.youth ? tokens.border : "divider",
                                                backgroundColor: option.youth ? tokens.subtleBackground : "background.paper",
                                                transition: "border-color 0.2s, background-color 0.2s, transform 0.2s",
                                                "&:hover": {
                                                    borderColor: option.youth ? tokens.accent : "primary.main",
                                                    backgroundColor: option.youth ? tokens.hoverBackground : brandColours.navyLight,
                                                    transform: "translateY(-2px)"
                                                }
                                            }}
                                        >
                                            {option.youth ? (
                                                <SectionSymbol section={option.value as ScoutSection} />
                                            ) : (
                                                <Typography aria-hidden="true" sx={{ fontSize: "2rem" }}>{option.icon}</Typography>
                                            )}
                                            <Typography variant="h6" sx={{ mt: 1, color: option.youth ? tokens.foreground : "secondary.main" }}>{option.label}</Typography>
                                            <Typography variant="body2" color="text.secondary">{option.ages}</Typography>
                                        </Paper>
                                    </Button>
                                );
                            })}
                        </Box>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
