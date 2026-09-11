import { Box, Container, Paper, Typography } from "@mui/material";
import { BUILD_NUMBER, SHORT_BUILD_COMMIT } from "../buildInfo";
import PublicWhosWho from "../components/PublicWhosWho";
import { usePublicSiteContent } from "../components/PublicSiteContentProvider";

export default function About() {
  const content = usePublicSiteContent();
  return (
    <Box sx={{ py: { xs: 4, md: 6 }, backgroundColor: "background.default" }}>
      <Container maxWidth="lg">
        <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 }, mb: 4 }}>
          <Typography component="h1" variant="h3" color="secondary" sx={{ fontWeight: 800 }}>
            {content.about.title}
          </Typography>
          <Typography sx={{ mt: 2 }}>{content.about.intro}</Typography>
        </Paper>

        <Box component="section" aria-labelledby="whos-who-heading">
          <Typography id="whos-who-heading" variant="h3" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>
            {content.about.whosWhoTitle}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>{content.about.whosWhoIntro}</Typography>
          <PublicWhosWho />
        </Box>

        <Paper component="section" aria-labelledby="build-information-heading" variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mt: 4 }}>
          <Typography id="build-information-heading" variant="h6" color="secondary" sx={{ fontWeight: 800 }}>
            Build information
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Build {BUILD_NUMBER} · Commit {SHORT_BUILD_COMMIT}
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
