import { Box, Container, Link, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function Privacy() {
  return (
    <Box sx={{ backgroundColor: "background.default", py: { xs: 4, md: 7 } }}>
      <Container maxWidth="md">
        <Paper elevation={2} sx={{ p: { xs: 3, md: 5 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography component="h1" variant="h3" color="secondary">
                Privacy &amp; data protection
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                How the Coolock Ardlea Scout Group website handles personal information.
              </Typography>
            </Box>

            <Box>
              <Typography component="h2" variant="h5" color="secondary">Who operates this website</Typography>
              <Typography sx={{ mt: 1 }}>
                This website is operated for the 80th/160th Coolock Ardlea Scout Group. If you have a question about personal information held through the website, use our <Link component={RouterLink} to="/contact">Contact Us</Link> page so the appropriate Group representative can respond.
              </Typography>
            </Box>

            <Box>
              <Typography component="h2" variant="h5" color="secondary">Information we handle</Typography>
              <Typography sx={{ mt: 1 }}>
                Depending on the service you use, the website may handle member and child details, parent or guardian contact details, emergency contacts, attendance and badgework information, joining enquiries, event and activity responses, photographs where authorised, financial or operational records, and consent or medical information supplied for safeguarding and activity administration.
              </Typography>
            </Box>

            <Box>
              <Typography component="h2" variant="h5" color="secondary">Why information is used</Typography>
              <Typography sx={{ mt: 1 }}>
                Information is used to operate the Scout Group website and the related membership, safeguarding, communications, events, consent, finance and administration workflows. Access to non-public information is restricted according to the user&apos;s role and, where relevant, their relationship to the member record.
              </Typography>
            </Box>

            <Box>
              <Typography component="h2" variant="h5" color="secondary">Service providers</Typography>
              <Typography sx={{ mt: 1 }}>
                The website uses third-party infrastructure and service providers to deliver its functionality, including Firebase/Google services for authentication, database, file storage and hosting, Cloudflare Workers for server-side email handling, and Resend for email delivery. These providers process information only as needed to provide the relevant service.
              </Typography>
            </Box>

            <Box>
              <Typography component="h2" variant="h5" color="secondary">Retention and account lifecycle</Typography>
              <Typography sx={{ mt: 1 }}>
                Records are not intended to be kept indefinitely. The Group is documenting retention and deletion rules by data category, including what happens when a member, parent or leader becomes inactive or leaves. Until those rules are formally approved, this page does not state fixed retention periods that have not been agreed.
              </Typography>
            </Box>

            <Box>
              <Typography component="h2" variant="h5" color="secondary">Your information and requests</Typography>
              <Typography sx={{ mt: 1 }}>
                If you want to ask what information is held about you or your child, request a correction, raise a privacy concern, or ask about deletion or restriction of information, contact the Group through the <Link component={RouterLink} to="/contact">Contact Us</Link> page. Requests will be reviewed in the context of safeguarding, legal and record-keeping obligations that may apply.
              </Typography>
            </Box>

            <Box>
              <Typography component="h2" variant="h5" color="secondary">Cookies and browser storage</Typography>
              <Typography sx={{ mt: 1 }}>
                The application uses Firebase Authentication session storage as part of sign-in. The compliance review did not identify application-managed non-essential advertising or behavioural analytics storage. If that changes, this information must be updated before such technology is introduced.
              </Typography>
            </Box>

            <Box>
              <Typography component="h2" variant="h5" color="secondary">Review status</Typography>
              <Typography sx={{ mt: 1 }}>
                This information reflects the website architecture reviewed in September 2026. It is intended to provide clear operational transparency and does not replace any additional notices or policies required by Scouting Ireland, the Scout Group, or applicable law.
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
