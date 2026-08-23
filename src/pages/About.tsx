import { Box, Container, Paper, Typography } from "@mui/material";
import PublicWhosWho from "../components/PublicWhosWho";

export default function About() {
  return (
    <Box sx={{ py: { xs: 4, md: 6 }, backgroundColor: "background.default" }}>
      <Container maxWidth="lg">
        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 }, mb: 4 }}>
          <Typography variant="h3" color="secondary" sx={{ fontWeight: 800 }}>
            About Us
          </Typography>
          <Typography sx={{ mt: 2 }}>
            Welcome to 80th 160th Coolock Ardlea Scout Group.
          </Typography>
        </Paper>

        <Box component="section" aria-labelledby="whos-who-heading">
          <Typography id="whos-who-heading" variant="h3" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>
            Who’s Who
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Meet the leaders who have chosen to be listed publicly.
          </Typography>
          <PublicWhosWho />
        </Box>
      </Container>
    </Box>
  );
}
