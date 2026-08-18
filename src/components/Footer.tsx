import {
    Box,
    Container,
    Typography
} from "@mui/material";

import { BUILD_NUMBER } from "../buildInfo";
import { brandColours } from "../theme/theme";

export default function Footer() {
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
                    textAlign: "center"
                }}
            >
                <Typography
                    sx={{
                        fontWeight: 700
                    }}
                >
                    © {new Date().getFullYear()}{" "}
                    80th 160th Coolock Ardlea Scout Group
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
