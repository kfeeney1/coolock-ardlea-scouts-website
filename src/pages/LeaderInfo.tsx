import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";

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

type StageStatus = "Complete" | "Current" | "Planned";

type Stage = {
    number: string;
    title: string;
    status: StageStatus;
    summary: string;
};

const stages: Stage[] = [
    { number: "1", title: "Public Website & Join Us", status: "Complete", summary: "Public website, joining enquiries, waiting-list management and conversion of accepted enquiries into member records." },
    { number: "2", title: "Consent & Parent Access", status: "Complete", summary: "Youth consent, Scouter ES3, medication management, parent accounts, linked children and parent consent updates." },
    { number: "3", title: "Leader Portal & Roles", status: "Complete", summary: "Leader registration, approval, profiles, section-scoped permissions, Group roles and the public Who’s Who opt-in." },
    { number: "4", title: "Members & Organisation", status: "Complete", summary: "Member management, section moves, member history, parent links, organisation chart and role-based access." },
    { number: "5", title: "Events & Communications", status: "Complete", summary: "Events, camps and trips, parent event consent, attendance rosters, communications, reports and exports." },
    { number: "6", title: "Weekly Meetings", status: "Complete", summary: "Create, open, save, close, reopen and copy section meetings with fast attendance, flexible programme planning, badgework, incidents and meeting history." },
    { number: "7", title: "Meeting Records & Reporting", status: "Complete", summary: "Leader and Group Council meeting records, all-section history for authorised Group roles, attendance insights, activity logs and operational reporting." },
    { number: "8", title: "Production Hardening & Continuous Improvement", status: "Current", summary: "Security, audit, privacy, accessibility, backups, live-data compatibility, stable test seeds and regression coverage as the portal evolves." }
];

const faqs = [
    { q: "Where are members stored?", a: "Member records are stored in Firestore. Use Member Management for the current record and Member History for retained lifecycle history." },
    { q: "How are members created?", a: "Accepted Join Us enquiries can be converted into member records, and authorised leaders can also add existing members manually from Member Management." },
    { q: "Can leaders move members between sections or change their status?", a: "Yes. Authorised leaders can move members between sections and set their status to Active, Inactive or Left. Relevant history is retained." },
    { q: "How does parent access work?", a: "Parent accounts are approved separately and linked to the correct children. Leaders can search for a child when managing links rather than loading the full member list." },
    { q: "How are consent and medical details handled?", a: "Member Management shows useful consent, medical, medication and expiry indicators. Full consent and medical details remain in the restricted consent-management areas." },
    { q: "How does event consent work?", a: "For an open event that requires consent, leaders can provide the parent-facing consent flow. Responses can be matched to members, reviewed and reflected in the event roster." },
    { q: "What happens if an event-consent response cannot be matched?", a: "It remains visible as unmatched. An authorised leader can match it to the correct member or ignore a duplicate or test response." },
    { q: "What happens when an event is completed?", a: "Completed events remain available as history. Authorised leaders can still review the roster and use the available reporting and export tools." },
    { q: "How do weekly meetings work?", a: "Weekly Meetings starts with Create Meeting, Open Meeting and Meeting History. A meeting can be planned, saved, reopened while open, closed when finished, and later reopened by an authorised leader if corrections are needed." },
    { q: "How do I take attendance at a weekly meeting?", a: "Attendance uses large present checkboxes for quick roll call. Mark all present can select the visible roster at once, and unchecked members are recorded as absent when attendance is saved." },
    { q: "What can I plan in a weekly meeting?", a: "The planner supports a theme, programme notes, flexible activity/game rows and badgework rows. Activity rows can include a leader, instructions or notes, equipment and start/finish times." },
    { q: "Can I copy a meeting for next week?", a: "Yes. Copy Meeting creates a new open meeting; it never overwrites the original. You can use today or choose another date. Reusable programme structure is copied, while attendance, completed badgework, injuries/medical incidents and post-meeting notes are reset." },
    { q: "Can I copy a closed meeting from Meeting History?", a: "Yes. Meeting History can be used as a source for Copy Meeting, which is useful for reusing a successful programme as a template." },
    { q: "Who can see or edit weekly meetings?", a: "Section leaders work within their assigned sections. The Group Leader can work across sections, the Group Secretary has all-section weekly meeting history access without section editing rights, and administrators retain their authorised management access." },
    { q: "What are Meeting Records for?", a: "Meeting Records are for formal leader and Group Council meeting notes, decisions and actions. They are separate from Weekly Meetings, which track the youth-section programme and attendance." },
    { q: "Who can see Group and section meeting history?", a: "Access is role-based. Group Leader and Group Secretary roles can view the broader meeting history needed for their roles, while section leaders remain scoped to their permitted sections." },
    { q: "Where can I see attendance trends?", a: "Attendance Insights provides reporting based on recorded attendance. Weekly Meeting History remains the place to inspect the detail of an individual meeting." },
    { q: "Why might I see fewer menu options than another leader?", a: "The Leader Portal is permission-aware. Available pages and actions depend on your approved access level, assigned sections and Scouting role." },
    { q: "Where is Sign Out?", a: "Sign Out is the final action in the expandable Leader Menu, keeping the dashboard header compact on mobile." },
    { q: "How is test data kept stable?", a: "Automated tests use canonical seeded records with stable identifiers and explicit seed-contract checks. New features should extend those canonical seeds and Playwright coverage rather than introduce competing test-data sources." }
];

function chipColor(status: StageStatus): "success" | "warning" | "secondary" {
    if (status === "Complete") return "success";
    if (status === "Current") return "warning";
    return "secondary";
}

export default function LeaderInfo() {
    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />

                <LeaderPageHeader
                    title="Leader Portal Information"
                    description="Current portal capabilities, development status and frequently asked questions."
                />

                <Alert severity="info" sx={{ mb: 3 }}>
                    Core portal workflows are live. Stage 8 — Production Hardening & Continuous Improvement — remains ongoing as features and safeguards evolve.
                </Alert>

                <Typography variant="h4" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>
                    Development Roadmap
                </Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 5 }}>
                    {stages.map((stage) => (
                        <Paper
                            key={stage.number}
                            variant="outlined"
                            sx={{
                                p: 2.5,
                                borderRadius: 2,
                                borderLeft: "5px solid",
                                borderLeftColor: stage.status === "Current" ? "warning.main" : stage.status === "Complete" ? "success.main" : "secondary.main"
                            }}
                        >
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                                <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>
                                    Stage {stage.number}
                                </Typography>
                                <Chip label={stage.status} color={chipColor(stage.status)} size="small" variant={stage.status === "Planned" ? "outlined" : "filled"} />
                            </Stack>
                            <Typography variant="h6" sx={{ mt: 1.25, fontWeight: 700 }}>{stage.title}</Typography>
                            <Typography color="text.secondary" sx={{ mt: 0.75 }}>{stage.summary}</Typography>
                        </Paper>
                    ))}
                </Box>

                <Typography variant="h4" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>
                    Frequently Asked Questions
                </Typography>

                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                    {faqs.map((faq, index) => (
                        <Accordion
                            key={faq.q}
                            disableGutters
                            elevation={0}
                            sx={{ "&:before": { display: "none" }, borderBottom: index < faqs.length - 1 ? "1px solid" : "none", borderColor: "divider" }}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography sx={{ fontWeight: 700, color: "secondary.main" }}>{faq.q}</Typography>
                            </AccordionSummary>
                            <AccordionDetails><Typography>{faq.a}</Typography></AccordionDetails>
                        </Accordion>
                    ))}
                </Paper>
            </Container>
        </Box>
    );
}
