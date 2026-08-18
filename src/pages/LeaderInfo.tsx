import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Chip,
    Container,
    Paper,
    Stack,
    Typography
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

type StageStatus =
    | "Complete"
    | "Current"
    | "Planned";

type Stage = {
    number: string;
    title: string;
    status: StageStatus;
    summary: string;
};

const stages: Stage[] = [
    {
        number: "1",
        title: "Public Website & Join Us",
        status: "Complete",
        summary:
            "Public website, Firebase Hosting and Firestore joining enquiries."
    },
    {
        number: "2",
        title: "Consent Forms",
        status: "Complete",
        summary:
            "Youth consent, Scouter ES3 and medication-management forms."
    },
    {
        number: "3",
        title: "Leader Portal",
        status: "Complete",
        summary:
            "Leader authentication, registration, approval and profile management."
    },
    {
        number: "4",
        title: "Consent Management",
        status: "Complete",
        summary:
            "Leader consent search, expiry, medical indicators and printing."
    },
    {
        number: "5",
        title: "Join Us Management",
        status: "Complete",
        summary:
            "Joining workflow, filterable waiting list, notes, contact history and member conversion."
    },
    {
        number: "6",
        title: "Member Management",
        status: "Current",
        summary:
            "Member directory, member editing, section movement, contacts and consent indicators."
    },
    {
        number: "7",
        title: "Events & Activities",
        status: "Planned",
        summary:
            "Camps, trips, attendance and activity consent tracking."
    },
    {
        number: "8",
        title: "Production Hardening",
        status: "Planned",
        summary:
            "Security, audit, privacy, accessibility, monitoring and backup readiness."
    }
];

const faqs = [
    {
        q: "Where are members stored?",
        a:
            "Member records are stored in the Firestore members collection."
    },
    {
        q: "How are members created?",
        a:
            "Stage 5 can convert an Accepted Join Us enquiry into a member record."
    },
    {
        q: "Can leaders move members between sections?",
        a:
            "Yes. Stage 6 allows an authorised leader to change the member's section."
    },
    {
        q: "Can a member be marked inactive or left?",
        a:
            "Yes. Member status can be Active, Inactive or Left."
    },
    {
        q: "How are consent records matched?",
        a:
            "For this first Stage 6 version, matching uses the member name and date of birth. A later refinement can add an explicit memberId link to consent submissions."
    },
    {
        q: "Where do medical details remain?",
        a:
            "Member Management shows medical, medication and expiry indicators. Full medical details remain in Consent Management."
    }
];

function chipColor(
    status: StageStatus
):
    | "success"
    | "warning"
    | "secondary" {
    if (
        status === "Complete"
    ) {
        return "success";
    }

    if (
        status === "Current"
    ) {
        return "warning";
    }

    return "secondary";
}

export default function LeaderInfo() {
    return (
        <Box
            sx={{
                minHeight:
                    "100vh",
                backgroundColor:
                    "background.default",
                py: {
                    xs: 4,
                    md: 6
                }
            }}
        >
            <Container maxWidth="xl">
                <LeaderDashboardHeader />

                <Paper
                    elevation={2}
                    sx={{
                        p: {
                            xs: 2.5,
                            md: 3
                        },
                        mb: 3,
                        borderRadius: 2,
                        borderLeft:
                            "5px solid",
                        borderLeftColor:
                            "secondary.main"
                    }}
                >
                    <Typography
                        variant="h4"
                        color="secondary"
                        sx={{
                            fontWeight: 800
                        }}
                    >
                        Leader Portal Information
                    </Typography>

                    <Typography
                        color="text.secondary"
                        sx={{
                            mt: 0.75
                        }}
                    >
                        Development roadmap, current stage information and frequently asked questions.
                    </Typography>
                </Paper>

                <Alert
                    severity="info"
                    sx={{
                        mb: 3
                    }}
                >
                    Stages 1–5 are complete. Stage 6 — Member Management — is currently in progress.
                </Alert>

                <Typography
                    variant="h4"
                    color="secondary"
                    sx={{
                        mb: 2,
                        fontWeight: 800
                    }}
                >
                    Development Roadmap
                </Typography>

                <Box
                    sx={{
                        display:
                            "grid",
                        gridTemplateColumns:
                            {
                                xs: "1fr",
                                md:
                                    "1fr 1fr"
                            },
                        gap: 2,
                        mb: 5
                    }}
                >
                    {stages.map(
                        (
                            stage
                        ) => (
                            <Paper
                                key={
                                    stage.number
                                }
                                variant="outlined"
                                sx={{
                                    p: 2.5,
                                    borderRadius: 2,
                                    borderLeft:
                                        "5px solid",
                                    borderLeftColor:
                                        stage.status ===
                                        "Current"
                                            ? "warning.main"
                                            : stage.status ===
                                                "Complete"
                                              ? "success.main"
                                              : "secondary.main"
                                }}
                            >
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        alignItems:
                                            "center",
                                        flexWrap:
                                            "wrap",
                                        rowGap:
                                            1
                                    }}
                                >
                                    <Typography
                                        variant="h5"
                                        color="secondary"
                                        sx={{
                                            fontWeight:
                                                800
                                        }}
                                    >
                                        Stage{" "}
                                        {
                                            stage.number
                                        }
                                    </Typography>

                                    <Chip
                                        label={
                                            stage.status
                                        }
                                        color={
                                            chipColor(
                                                stage.status
                                            )
                                        }
                                        size="small"
                                        variant={
                                            stage.status ===
                                            "Planned"
                                                ? "outlined"
                                                : "filled"
                                        }
                                    />
                                </Stack>

                                <Typography
                                    variant="h6"
                                    sx={{
                                        mt: 1.25,
                                        fontWeight:
                                            700
                                    }}
                                >
                                    {
                                        stage.title
                                    }
                                </Typography>

                                <Typography
                                    color="text.secondary"
                                    sx={{
                                        mt: 0.75
                                    }}
                                >
                                    {
                                        stage.summary
                                    }
                                </Typography>
                            </Paper>
                        )
                    )}
                </Box>

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
                        borderRadius: 2,
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
                                    faq.q
                                }
                                disableGutters
                                elevation={0}
                                sx={{
                                    "&:before":
                                        {
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
                                            faq.q
                                        }
                                    </Typography>
                                </AccordionSummary>

                                <AccordionDetails>
                                    <Typography>
                                        {
                                            faq.a
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
