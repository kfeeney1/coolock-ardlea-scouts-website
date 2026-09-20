import {
    Alert,
    Box,
    Button,
    Container,
    Paper,
    Typography
} from "@mui/material";
import { useLayoutEffect, useRef, useState } from "react";

import YouthConsentForm from "../components/consent/YouthConsentForm";
import { brandColours } from "../theme/theme";
import { sectionVisualTokens } from "../theme/sectionColours";
import { usePublicSiteContent } from "../components/PublicSiteContentProvider";
import { OfficialSectionIcon } from "../components/SectionIdentityControls";
import type {
    ScoutSection,
    YouthScoutSection
} from "../services/consentApplications";

export default function ConsentForm() {
    const content = usePublicSiteContent();
    const sectionOptions = content.sections.filter((option) => option.youth);
    const [section, setSection] = useState<ScoutSection | null>(null);
    const pendingScrollY = useRef<number | null>(null);
    const preservedPageHeight = useRef<number | null>(null);

    const changeSection = (nextSection: ScoutSection | null) => {
        pendingScrollY.current = window.scrollY;
        preservedPageHeight.current = document.documentElement.scrollHeight;
        setSection(nextSection);
    };

    useLayoutEffect(() => {
        if (pendingScrollY.current === null) return;
        const scrollY = pendingScrollY.current;
        pendingScrollY.current = null;
        // Replacing the chooser with the form removes the clicked DOM anchor. Preserve
        // the user\'s viewport instead of allowing browser scroll anchoring to jump.
        if (Math.abs(window.scrollY - scrollY) > 1) window.scrollTo({ top: scrollY, behavior: "auto" });
    }, [section]);

    if (section) {
        return (
            <Box data-testid="consent-form-view" sx={{ minHeight: preservedPageHeight.current ? `${preservedPageHeight.current}px` : "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 }, overflowAnchor: "none" }}>
                <Container maxWidth="md">
                    <YouthConsentForm section={section as YouthScoutSection} onChangeSection={() => changeSection(null)} />
                </Container>
            </Box>
        );
    }

    return (
        <Box data-testid="consent-section-chooser" sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 }, overflowAnchor: "none" }}>
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
                                        onClick={() => changeSection(option.value as ScoutSection)}
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
                                                <OfficialSectionIcon section={option.value} size={112} testId={`official-section-symbol-${option.value.toLowerCase()}`} />
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
