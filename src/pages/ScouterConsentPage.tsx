import { Box, Container } from "@mui/material";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import ScouterConsentForm from "../components/consent/ScouterConsentForm";

export default function ScouterConsentPage() {
    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <Container maxWidth="md" disableGutters>
                    <ScouterConsentForm backLabel="Back to My Profile" backTo="/leader/profile" />
                </Container>
            </Container>
        </Box>
    );
}
