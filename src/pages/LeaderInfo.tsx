import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import OrganisationChartContent from "../components/admin/OrganisationChartContent";

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
    { number: "8", title: "Production Hardening & Continuous Improvement", status: "Complete", summary: "Production hardening baseline completed: Hosting security and privacy guards, audit-log integrity, live-data/schema compatibility, accessibility coverage, dependency maintenance, backup/recovery, route code-splitting, application error recovery, CI cleanup and Firestore read-efficiency safeguards." }
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
    { q: "How do weekly meetings work?", a: "Weekly Meetings starts with Create Meeting, Open Meeting and Meeting History. Future meetings open into Programme for planning. A meeting can be saved, reopened while open, closed when finished, and later reopened by an authorised leader if corrections are needed." },
    { q: "How do I take attendance at a weekly meeting?", a: "Attendance uses large present checkboxes for quick roll call. Mark all present can select the visible roster at once, and unchecked members are recorded as absent when attendance is saved." },
    { q: "What can I plan in a weekly meeting?", a: "The planner supports a theme, programme notes, flexible activity/game rows and planned badgework within Programme. Activity rows can include one or more assigned leaders, instructions or notes, equipment and start/finish times. Completed badgework is recorded as meeting outcome data rather than copied as template content." },
    { q: "Can I copy a meeting for next week?", a: "Yes. Copy Meeting creates a new open meeting; it never overwrites the original. You can use today or choose another date. Reusable programme structure is copied, while attendance, completed badgework, injuries/medical incidents and post-meeting notes are reset." },
    { q: "Can I copy a closed meeting from Meeting History?", a: "Yes. Meeting History can be used as a source for Copy Meeting, which is useful for reusing a successful programme as a template." },
    { q: "Who can see or edit weekly meetings?", a: "Section leaders work within their assigned sections. The Group Leader can work across sections, the Group Secretary has all-section weekly meeting history access without section editing rights, and administrators retain their authorised management access." },
    { q: "What are Meeting Records for?", a: "Meeting Records are for formal leader and Group Council meeting notes, decisions and actions. They are separate from Weekly Meetings, which track the youth-section programme and attendance." },
    { q: "Who can see Group and section meeting history?", a: "Access is role-based. Group Leader and Group Secretary roles can view the broader meeting history needed for their roles, while section leaders remain scoped to their permitted sections." },
    { q: "Where can I see attendance trends?", a: "Attendance Insights provides reporting based on recorded attendance. Weekly Meeting History remains the place to inspect the detail of an individual meeting." },
    { q: "Why might I see fewer menu options than another leader?", a: "The Leader Portal is permission-aware. Available pages and actions depend on your approved access level, assigned sections and Scouting role." },
    { q: "Where is the organisational chart?", a: "The internal organisational chart is now included on this Info & FAQ page so leaders can find organisational information and guidance in one place." },
    { q: "Where is Sign Out?", a: "Sign Out is the final action in the expandable Leader Menu, keeping the dashboard header compact on mobile." },
    { q: "How is production data protected from schema drift?", a: "CI includes live Firestore provenance and compatibility checks for current collection contracts, including weekly meetings and meeting records. Safely migratable legacy shapes have dedicated reconcilers, while ambiguous or incompatible records remain blocking findings." },
    { q: "What happens if production Firestore is temporarily quota-exhausted during a pull request?", a: "Pull-request live-data auditing first probes production availability. If Firestore is quota-exhausted or unreachable, that live portion is explicitly deferred rather than producing a false application failure. Pushes to main and manual production audits still fail closed." },
    { q: "How is the site protected if a page crashes?", a: "The application has a top-level error boundary. Unexpected render failures show an accessible recovery screen with Reload page and Return home actions instead of leaving a blank application." },
    { q: "How is accessibility checked?", a: "Playwright includes an accessibility resilience baseline across representative public, parent and leader routes, covering semantic page structure, headings, image alternatives, named interactive controls and keyboard focus entry." },
    { q: "How are backups handled?", a: "Firestore has a managed backup/export workflow and a documented recovery runbook. Operators should confirm a recent backup before major production changes or migrations." },
    { q: "How are dependencies kept secure?", a: "The Quality gate blocks high or critical vulnerabilities in production npm dependencies, and Dependabot provides grouped recurring maintenance updates. Secret-dependent workflows use a safe policy for Dependabot pull requests." },
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
                    description="Current portal capabilities, organisational information, development status and frequently asked questions."
                />

                <Alert severity="success" sx={{ mb: 3 }}>
                    Stages 1–8 are complete. The portal is now in ongoing maintenance and continuous improvement: future changes should preserve the security, data-integrity, accessibility, recovery and regression safeguards established during Stage 8.
                </Alert>

                <Typography variant="h4" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>
                    Organisational Chart
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Internal organisational hierarchy, sections and reporting relationships for active leaders.
                </Typography>
                <Box sx={{ mb: 5 }}>
                    <OrganisationChartContent />
                </Box>

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
