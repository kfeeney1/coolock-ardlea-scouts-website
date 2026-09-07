import {
    Box,
    Container,
    Typography
} from "@mui/material";

import { BUILD_NUMBER } from "../buildInfo";
import { SITE_IDENTITY } from "../content/siteIdentity";
import { brandColours } from "../theme/theme";
import { usePublicSiteContent } from "./PublicSiteContentProvider";

export default function Footer() {
    const content = usePublicSiteContent();
    return (
        <Box
            component="footer"
            sx={{
                mt: 6,
                backgroundColor: "secondary.main",
                color: "secondary.contrastText",
                borderTop: `5px solid ${brandColours.coral}`
            }}
        >
            <Container
                maxWidth="lg"
                sx={{
                    py: 3,
                    px: { xs: 2, sm: 3 },
                    textAlign: "center"
                }}
            >
                <Typography
                    sx={{
                        fontWeight: 700
                    }}
                >
                    © {new Date().getFullYear()}{" "}
                    {content.group.name}
                </Typography>

                <Typography
                    variant="body2"
                    sx={{
                        mt: 0.75,
                        lineHeight: 1.5,
                        color: "secondary.contrastText"
                    }}
                >
                    Registered Charity Number (RCN): {SITE_IDENTITY.registeredCharityNumber}
                </Typography>

                <Typography
                    variant="caption"
                    sx={{
                        display: "block",
                        mt: 0.75,
                        color: "rgba(255,255,255,0.75)"
                    }}
                >
                    Build {BUILD_NUMBER}
                </Typography>
            </Container>
        </Box>
    );
}
