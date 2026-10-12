import { Container, Typography } from "@mui/material";
import ActionLinkButton from "../components/ActionLinkButton";
import { usePublicSiteContent } from "../components/PublicSiteContentProvider";
import { SITE_IDENTITY } from "../content/siteIdentity";

export default function Contact() {
    const content = usePublicSiteContent();
    return (
        <Container>
            <Typography component="h1" variant="h3">{content.contact.title}</Typography>
            <Typography sx={{ mt: 2 }}>{content.contact.body}</Typography>
            <ActionLinkButton
                href={`mailto:${SITE_IDENTITY.publicEmail}`}
                sx={{ display: "inline-block", mt: 1, overflowWrap: "anywhere" }}
            >
                {SITE_IDENTITY.publicEmail}
            </ActionLinkButton>
        </Container>
    );
}
