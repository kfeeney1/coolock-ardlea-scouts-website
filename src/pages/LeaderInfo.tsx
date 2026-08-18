import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    Container,
    Divider,
    Paper,
    Stack,
    Typography
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Link } from "react-router-dom";

import { brandColours } from "../theme/theme";

type Stage = {
    number: string;
    title: string;
    status: "Complete" | "Planned";
    summary: string;
    items: string[];
};

const completedStages: Stage[] = [
    {
        number: "1",
        title: "Public Website & Join Us",
        status: "Complete",
        summary:
            "Core public website, branding, navigation and the Join Us enquiry form.",
        items: [
            "Responsive public React website.",
            "Coolock Ardlea Scout Group branding and colours.",
            "Join Us enquiry form.",
            "Join enquiries saved to Cloud Firestore.",
            "Firebase Hosting deployment.",
            "Build number shown on the website."
        ]
    },
    {
        number: "2",
        title: "Consent Forms",
        status: "Complete",
        summary:
            "Youth activity consent, Scouter ES3 and medication-management forms.",
        items: [
            "Youth Activities Consent form.",
            "Scouter ES3 18+ Medical Advice form.",
            "SIF 20/10 Managing Medications section.",
            "Section selection for Beavers, Cubs, Scouts, Ventures, Rovers and Scouters.",
            "Consent submissions saved to Firestore.",
            "Medical, emergency-contact and declaration information captured."
        ]
    },
    {
        number: "3",
        title: "Leader Portal & Authentication",
        status: "Complete",
        summary:
            "Secure leader login, registration, approval and profile management.",
        items: [
            "Firebase Email/Password authentication.",
            "Protected Leader Dashboard.",
            "Leader self-registration.",
            "Admin approval workflow for new leader accounts.",
            "Leader profile page and password changes.",
            "Role and active-status checks in Firestore rules."
        ]
    },
    {
        number: "4",
        title: "Consent Management",
        status: "Complete",
        summary:
            "Leader-facing consent management and medical-information review.",
        items: [
            "Dedicated Consent Management page.",
            "Search and filtering.",
            "Youth and Scouter ES3 views.",
            "Medical and medication indicators.",
            "Expiry and expiring-soon filters.",
            "Structured SIF 20/10 medication display.",
            "Print and Save as PDF support."
        ]
    },
    {
        number: "5",
        title: "Join Us Management",
        status: "Complete",
        summary:
            "Dedicated leader workflow for joining enquiries and waiting-list management.",
        items: [
            "Dedicated Join Us Management page.",
            "New, Contacted, Waiting List, Accepted and Closed workflow.",
            "Search and section/status filters.",
            "Internal leader notes.",
            "Contact-history tracking.",
            "Waiting-list overview.",
            "Accepted enquiries can be converted atomically into member records."
        ]
    }
];

const futureStages: Stage[] = [
    {
        number: "6",
        title: "Member Management",
        status: "Planned",
        summary:
            "A central member directory linked to consent and contact information.",
        items: [
            "Member directory.",
            "Section membership.",
            "Parent / guardian details.",
            "Emergency contacts.",
            "Link current consent records to members.",
            "Consent expiry indicators.",
            "Medication warning indicators.",
            "Move members between sections."
        ]
    },
    {
        number: "7",
        title: "Events & Activities",
        status: "Planned",
        summary:
            "Manage camps, trips and activities with attendance and consent tracking.",
        items: [
            "Create camps, trips and activities.",
            "Choose participating sections.",
            "Track attendance.",
            "Activity-specific consent where needed.",
            "Missing-consent list.",
            "Relevant emergency and medical information for authorised leaders."
        ]
    },
    {
        number: "8",
        title: "Production Hardening",
        status: "Planned",
        summary:
            "Final security, privacy, resilience and operational checks.",
        items: [
            "Tighten Firestore rules.",
            "Refine leader roles and permissions.",
            "Audit trail for administrative actions.",
            "Data-retention and deletion controls.",
            "Privacy / GDPR review.",
            "Accessibility and mobile usability review.",
            "Error logging and operational monitoring.",
            "Backup and recovery planning."
        ]
    }
];

const faqs = [
    {
        question: "Where is the website hosted?",
        answer:
            "The public website is hosted using Firebase Hosting. The source code is stored in GitHub for version control."
    },
    {
        question: "Where are Join Us enquiries stored?",
        answer:
            "Join Us submissions are stored in the Firestore collection named joinApplications."
    },
    {
        question: "How are Join Us enquiries managed?",
        answer:
            "Leaders can use Join Us Management to move enquiries through New, Contacted, Waiting List, Accepted and Closed, keep internal notes and record contact history."
    },
    {
        question: "What happens when an enquiry is accepted?",
        answer:
            "An accepted enquiry can be converted into a member record. The operation creates a members document and links the original joining enquiry to it."
    },
    {
        question: "Where are consent forms stored?",
        answer:
            "Youth consent and Scouter ES3 submissions are stored in the Firestore collection named consentApplications."
    },
    {
        question: "Can the public read consent or medical information?",
        answer:
            "No. Firestore security rules restrict sensitive records to authenticated, active leader accounts."
    },
    {
        question: "How does a new leader get access?",
        answer:
            "A leader can register for an account. Their request remains pending until an administrator approves it."
    },
    {
        question: "Can a leader make themselves an administrator?",
        answer:
            "No. Leaders can edit permitted profile fields, but access roles and active status are protected."
    },
    {
        question: "Can leaders change their password?",
        answer:
            "Yes. The My Profile page allows a signed-in leader to change their password after re-entering their current password."
    },
    {
        question: "What does the Medical label mean?",
        answer:
            "It indicates that a consent record contains medical, allergy, dietary or similar information that should be reviewed before relevant activities."
    },
    {
        question: "What does the Medication label mean?",
        answer:
            "It means the member has a Managing Medications SIF 20/10 record attached to their consent."
    },
    {
        question: "Can a consent record be printed or saved as a PDF?",
        answer:
            "Yes. Consent Management provides a print-friendly view, and the browser print dialog can be used to save the record as a PDF."
    },
    {
        question: "Is the project backed up in GitHub?",
        answer:
            "The source code is stored in GitHub. Firestore data is separate and needs its own backup and retention strategy."
    }
];

function StageCard({
    stage
}: {
    stage: Stage;
}) {
    const complete =
        stage.status === "Complete";

    return (
        <Paper
            variant="outlined"
            sx={{
                p: 3,
                height: "100%",
                borderTop: "5px solid",
                borderTopColor:
                    complete
                        ? "success.main"
                        : "secondary.main"
            }}
        >
            <Stack
                direction="row"
                spacing={1}
                sx={{
                    alignItems: "center",
                    flexWrap: "wrap",
                    rowGap: 1
                }}
            >
                <Typography
                    variant="h5"
                    color="secondary"
                    sx={{
                        fontWeight: 800
                    }}
                >
                    Stage {stage.number}
                </Typography>

                <Chip
                    label={stage.status}
                    size="small"
                    color={
                        complete
                            ? "success"
                            : "secondary"
                    }
                    variant={
                        complete
                            ? "filled"
                            : "outlined"
                    }
                />
            </Stack>

            <Typography
                variant="h6"
                sx={{
                    mt: 1.5,
                    fontWeight: 700
                }}
            >
                {stage.title}
            </Typography>

            <Typography
                color="text.secondary"
                sx={{
                    mt: 1
                }}
            >
                {stage.summary}
            </Typography>

            <Box
                component="ul"
                sx={{
                    mt: 2,
                    mb: 0,
                    pl: 2.5
                }}
            >
                {stage.items.map(
                    (item) => (
                        <Box
                            component="li"
                            key={item}
                            sx={{
                                mb: 0.75
                            }}
                        >
                            <Typography variant="body2">
                                {item}
                            </Typography>
                        </Box>
                    )
                )}
            </Box>
        </Paper>
    );
}

export default function LeaderInfo() {
    return (
        <Box
            sx={{
                minHeight: "100vh",
                backgroundColor:
                    "background.default",
                py: {
                    xs: 4,
                    md: 6
                }
            }}
        >
            <Container maxWidth="lg">
                <Paper
                    elevation={3}
                    sx={{
                        overflow: "hidden",
                        mb: 4
                    }}
                >
                    <Box
                        sx={{
                            background: `linear-gradient(
                                135deg,
                                ${brandColours.coral},
                                ${brandColours.navy}
                            )`,
                            color: "white",
                            p: {
                                xs: 3,
                                md: 5
                            }
                        }}
                    >
                        <Typography
                            variant="h3"
                            component="h1"
                            sx={{
                                fontWeight: 800
                            }}
                        >
                            Leader Portal Information
                        </Typography>

                        <Typography
                            variant="h6"
                            sx={{
                                mt: 1.5,
                                opacity: 0.95
                            }}
                        >
                            What has been built, what is planned next, and answers to common questions.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            p: {
                                xs: 3,
                                md: 4
                            }
                        }}
                    >
                        <Alert
                            severity="success"
                            sx={{
                                mb: 3
                            }}
                        >
                            Stages 1–5 are complete. Stage 6 is the next planned development stage.
                        </Alert>

                        <Stack
                            direction={{
                                xs: "column",
                                sm: "row"
                            }}
                            spacing={1.5}
                        >
                            <Button
                                component={Link}
                                to="/leader"
                                variant="contained"
                                color="secondary"
                            >
                                Dashboard
                            </Button>

                            <Button
                                component={Link}
                                to="/leader/join"
                                variant="outlined"
                                color="secondary"
                            >
                                Join Us Management
                            </Button>

                            <Button
                                component={Link}
                                to="/leader/consents"
                                variant="outlined"
                                color="secondary"
                            >
                                Consent Management
                            </Button>

                            <Button
                                component={Link}
                                to="/leader/profile"
                                variant="outlined"
                                color="secondary"
                            >
                                My Profile
                            </Button>
                        </Stack>
                    </Box>
                </Paper>

                <Typography
                    variant="h4"
                    color="secondary"
                    sx={{
                        mb: 2,
                        fontWeight: 800
                    }}
                >
                    Completed Work
                </Typography>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            md: "1fr 1fr"
                        },
                        gap: 2.5,
                        mb: 5
                    }}
                >
                    {completedStages.map(
                        (stage) => (
                            <StageCard
                                key={stage.number}
                                stage={stage}
                            />
                        )
                    )}
                </Box>

                <Divider sx={{ my: 4 }} />

                <Typography
                    variant="h4"
                    color="secondary"
                    sx={{
                        mb: 2,
                        fontWeight: 800
                    }}
                >
                    Future Roadmap
                </Typography>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            md: "1fr 1fr"
                        },
                        gap: 2.5,
                        mb: 5
                    }}
                >
                    {futureStages.map(
                        (stage) => (
                            <StageCard
                                key={stage.number}
                                stage={stage}
                            />
                        )
                    )}
                </Box>

                <Divider sx={{ my: 4 }} />

                <Typography
                    variant="h4"
                    color="secondary"
                    sx={{
                        mb: 2,
                        fontWeight: 800
                    }}
                >
                    Frequently Asked Questions
                </Typography>

                <Paper
                    variant="outlined"
                    sx={{
                        overflow: "hidden"
                    }}
                >
                    {faqs.map(
                        (
                            faq,
                            index
                        ) => (
                            <Accordion
                                key={
                                    faq.question
                                }
                                disableGutters
                                elevation={0}
                                sx={{
                                    "&:before": {
                                        display:
                                            "none"
                                    },
                                    borderBottom:
                                        index <
                                        faqs.length -
                                            1
                                            ? "1px solid"
                                            : "none",
                                    borderColor:
                                        "divider"
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={
                                        <ExpandMoreIcon />
                                    }
                                >
                                    <Typography
                                        sx={{
                                            fontWeight:
                                                700,
                                            color:
                                                "secondary.main"
                                        }}
                                    >
                                        {
                                            faq.question
                                        }
                                    </Typography>
                                </AccordionSummary>

                                <AccordionDetails>
                                    <Typography>
                                        {
                                            faq.answer
                                        }
                                    </Typography>
                                </AccordionDetails>
                            </Accordion>
                        )
                    )}
                </Paper>
            </Container>
        </Box>
    );
}
