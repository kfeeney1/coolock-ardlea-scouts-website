import { Box, Container } from "@mui/material";
import { useNavigate } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import ScouterConsentForm from "../components/consent/ScouterConsentForm";

export default function ScouterConsentPage() {
    const navigate = useNavigate();

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <Container maxWidth="md" disableGutters>
                    <ScouterConsentForm backLabel="Back to My Profile" onChangeSection={() => navigate("/leader/profile")} />
                </Container>
            </Container>
        </Box>
    );
}
