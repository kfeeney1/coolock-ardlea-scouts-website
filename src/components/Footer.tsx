import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { SITE_IDENTITY } from "../content/siteIdentity";
import { brandColours } from "../theme/theme";
import { usePublicSiteContent } from "./PublicSiteContentProvider";

export default function Footer() {
    const content = usePublicSiteContent();
    return <Box component="footer" sx={{ mt: 6, backgroundColor: "secondary.main", color: "secondary.contrastText", borderTop: `5px solid ${brandColours.coral}` }}>
        <Container maxWidth="lg" sx={{ py: 3, px: { xs: 2, sm: 3 }, textAlign: "center" }}>
            <Typography sx={{ fontWeight: 700 }}>© {new Date().getFullYear()} {content.group.name}</Typography>
            <Typography variant="body2" sx={{ mt: 0.75, lineHeight: 1.5, color: "secondary.contrastText" }}>Registered Charity Number (RCN): {SITE_IDENTITY.registeredCharityNumber}</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: .5, sm: 2 }} sx={{ mt: 1, justifyContent: "center" }}>
                <Link component={RouterLink} to="/policies" sx={{ color: "secondary.contrastText", fontWeight: 700 }}>Policy documents</Link>
                <Link component={RouterLink} to="/privacy" sx={{ color: "secondary.contrastText", fontWeight: 700 }}>Privacy &amp; data protection</Link>
            </Stack>
        </Container>
    </Box>;
}
