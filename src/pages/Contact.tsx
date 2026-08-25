import { Container, Typography } from "@mui/material";
import { usePublicSiteContent } from "../components/PublicSiteContentProvider";

export default function Contact() {
    const content = usePublicSiteContent();
    return (
        <Container>
            <Typography component="h1" variant="h3">{content.contact.title}</Typography>
            <Typography sx={{ mt: 2 }}>{content.contact.body}</Typography>
        </Container>
    );
}
