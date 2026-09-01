import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import OrganisationChartContent from "../components/admin/OrganisationChartContent";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

type StageStatus = "Complete" | "Current" | "Planned";
type Stage = { number: string; title: string; status: StageStatus; summary: string; };

const stages: Stage[] = [
  { number: "1", title: "Public Website & Join Us", status: "Complete", summary: "Public website, joining enquiries, waiting-list management and conversion of accepted enquiries into member records." },
  { number: "2", title: "Consent & Parent Access", status: "Complete", summary: "Youth consent, Scouter ES3, medication management, parent accounts, linked children and parent consent updates." },
  { number: "3", title: "Leader Portal & Roles", status: "Complete", summary: "Leader registration, approval, profiles, section-scoped permissions, Group roles and the public Who’s Who opt-in." },
  { number: "4", title: "Members & Organisation", status: "Complete", summary: "Member management, section moves, member history, parent links, organisation chart and role-based access." },
  { number: "5", title: "Events & Communications", status: "Complete", summary: "Events, camps and trips, parent event consent, attendance, communications, reports and exports." },
  { number: "6", title: "Weekly Meetings", status: "Complete", summary: "Create, open, save, close and copy section meetings with attendance, programme planning, badgework, incidents and meeting history." },
  { number: "7", title: "Meeting Records & Reporting", status: "Complete", summary: "Leader and Group Council meeting records, authorised history, attendance insights, activity logs and operational reporting." },
  { number: "8", title: "Production Hardening & Continuous Improvement", status: "Complete", summary: "Hosting security, privacy guards, audit integrity, schema compatibility, accessibility, dependency maintenance, backup/recovery and Firestore read safeguards." },
  { number: "9", title: "Workflow, Consent & Usability Improvements", status: "Complete", summary: "Searchable history, improved navigation and mobile editing, richer Weekly Meetings, WhatsApp sharing, meeting import/version history and expanded reporting." },
  { number: "10", title: "Programme, Events & Insights", status: "Complete", summary: "Combined attendance insights, reusable Programme Library items, date-filtered reports, event close-out, Parent Portal tasks and read optimisation." },
  { number: "11", title: "Architecture, UX & Operational Hardening", status: "Complete", summary: "Dashboard and reporting improvements, Scout-year periods, route decomposition, configurable inactivity sign-out and stricter historical meeting editing." },
  { number: "12", title: "Adventure Skills & Badgework Tracking", status: "Complete", summary: "Scouting Ireland Adventure Skills competency tracking, multi-member entry, shared competencies, awards, provenance, meeting/event integration and parent read-only progress." },
  { number: "13", title: "Equipment & Stores", status: "Complete", summary: "Equipment inventory, checkout/return, incidents, immutable history, stock movements, programme reservations, reporting and role-based permissions." },
  { number: "14", title: "Architecture & Operational Hardening", status: "Complete", summary: "Current architecture and RBAC documentation, source-complexity guardrails, pinned Playwright tooling, broader Rules CI, WebKit critical-path coverage, email Worker contract tests, recovery guidance and deployed build identity." },
  { number: "15", title: "Section Floats & Receipts", status: "Complete", summary: "Append-only section float ledger, finance RBAC, float reconciliation, safe corrections, receipt attachments, reporting/exports and a focused Open float, Float top up, Money out and Close float workflow." },
  { number: "16", title: "Event Galleries", status: "Complete", summary: "Secure event photo galleries with leader management, image validation, consent-aware parent access, completed-event lifecycle support, accessibility/recovery hardening, security regression coverage and operational audit/backfill tooling." },
  { number: "17", title: "Leader Navigation & Information Architecture", status: "Complete", summary: "Task-based Leader Menu groups, compact route-aware mobile disclosure, preserved role-based visibility, clearer Account & Help actions, keyboard/Escape behaviour and focused desktop/mobile Playwright regression coverage." }
];

const faqs = [
  { q: "Where are members stored?", a: "Member records are stored in Firestore. Use Member Management for the current record and Member History for retained lifecycle history." },
  { q: "How are members created and moved?", a: "Accepted Join Us enquiries can become member records, and authorised leaders can add existing members manually. Authorised leaders can move members between sections or set Active, Inactive or Left status while relevant history is retained." },
  { q: "How does parent access work?", a: "Parent accounts are approved separately and linked to the correct children. Parent access is limited to parent-safe information for those linked children and does not expose internal leader, finance or equipment data." },
  { q: "How are consent and medical details handled?", a: "Member Management shows useful consent, medical, medication and expiry indicators. Full details remain in restricted consent-management areas. Approved parents can review permitted consent information for their linked children." },
  { q: "How does event consent work?", a: "For an open event that requires consent, leaders can open Manage Consent from the event. Parents use the tokenised consent flow, while authorised leaders can review and match responses and see consent state in Attendance." },
  { q: "What happens when an event is completed?", a: "Events progress through Draft, Open, Closed and Completed. Completion requires resolved attendance and, where required, resolved consent for attending members. Completed events remain read-only operational history while their authorised gallery can remain available under the gallery access rules." },
  { q: "How do Weekly Meetings work?", a: "Weekly Meetings supports creating, planning, saving, closing and copying meetings. Attendance, activities, badgework, programme notes, equipment requirements and incidents are handled in the meeting workflow. Closed meetings retain historical protections and only authorised limited corrections are allowed." },
  { q: "Can I copy a meeting?", a: "Yes. Copy Meeting creates a new meeting and never overwrites the source. Reusable programme structure can be copied while attendance, completed badgework, incidents, post-meeting notes, reservations and checkout transactions are reset." },
  { q: "What is the Programme Library?", a: "Leaders can save reusable activities, games and badgework items to a section-scoped library and insert fresh copies into future Weekly Meetings." },
  { q: "Can I share a Weekly Meeting in WhatsApp?", a: "Yes. The share text is parent-safe and can include programme, badgework and suitable equipment wording. It excludes attendance, incidents, internal notes and equipment stock internals." },
  { q: "How does Adventure Skills badgework work?", a: "Leaders can select one or more children, choose an Adventure Skill and stage, mark individual competencies or a full stage and explicitly save progress. Progress belongs to the member, so it persists across section moves." },
  { q: "Can parents see Adventure Skills progress?", a: "Yes. Approved parents can see read-only competency and award progress for their linked children. They cannot edit progress or award badges." },
  { q: "What is Equipment & Stores?", a: "Equipment & Stores tracks group inventory, categories, storage locations, section holdings, checkout/return, unavailable stock, incidents, immutable history, programme requirements/reservations and reports." },
  { q: "Who can manage equipment?", a: "The Group Quartermaster / Bo’sun, Group Leader and administrator roles can manage the full inventory. Active leaders have section-scoped operational access where permitted. Parents cannot access internal equipment data." },
  { q: "Can meetings and events reserve equipment?", a: "Yes. Weekly Meetings and Events & Activities can add planned equipment requirements, reserve stock and later convert appropriate reservations into real checkouts." },
  { q: "What are Meeting Records for?", a: "Meeting Records hold formal leader, Group Council and Group Leaders meeting notes, decisions and actions. They are separate from Weekly Meetings and retain read-only version history when edited." },
  { q: "Where can I see attendance trends?", a: "Attendance Insights provides Weekly Meeting, Event and Combined recorded-attendance rates, date filtering and per-member detail. Unrecorded attendance is excluded from the rate denominator." },
  { q: "What reports are available?", a: "Reports & Exports provides member, event, attendance, consent and operational reporting within the user’s permitted scope. Equipment & Stores and Section Floats also provide their own focused operational reports and exports." },
  { q: "What are Section Floats?", a: "Section Floats tracks physical section cash using an append-only ledger. The normal workflow is deliberately limited to Open float, Float top up, Money out and Close float. The displayed balance is derived from ledger entries rather than stored as an editable balance." },
  { q: "Who can access Section Floats?", a: "Finance access is role and section scoped. Section leaders work within their authorised sections, while Group Treasurer, Group Leader and administrator roles have the wider group access defined by Firestore Rules. Parents have no finance access." },
  { q: "Can a Section Float go below zero?", a: "No. Money out and correction workflows are protected from reducing the float below €0.00. A new float cannot be opened while the current float still has a positive balance, and Close float removes the full remaining balance." },
  { q: "How do receipts work?", a: "A receipt can be attached while recording Money out or added later from Transaction history. Supported uploads include phone camera/gallery JPEG, PNG and WebP images plus PDF receipts, subject to the secure attachment limits and finance permissions." },
  { q: "How are finance mistakes corrected?", a: "Historical ledger entries are not edited or deleted. Corrections create linked reversal/adjustment records so the original entry and the correction remain auditable." },
  { q: "What is an Event Gallery?", a: "An Event Gallery is a secure photo area attached to an event. Authorised leaders can upload and manage validated JPEG, PNG or WebP images from the event workflow. Gallery storage is section/event scoped and protected by Firebase Storage and Firestore access rules." },
  { q: "Who can manage Event Gallery photos?", a: "Assigned section leaders and authorised Group Leader/admin roles can manage galleries within their permitted scope. Gallery actions are protected by role and section checks rather than by client-side visibility alone." },
  { q: "Can parents see Event Galleries?", a: "Yes, but only through the consent-aware parent gallery projection. A parent must be authenticated and correctly linked, the event must be eligible for parent gallery access, and the child/access relationship must satisfy the server-enforced gallery rules. Event attendance consent is not treated as blanket photography consent." },
  { q: "Are Event Galleries public?", a: "No. Event gallery media is not a public website photo feed. Access is authenticated and governed by the gallery security and consent model." },
  { q: "What happens to a gallery after an event is completed?", a: "Completed events remain historical records and eligible authorised galleries can remain available for appropriate leader and parent access. Completion does not make gallery media public or bypass consent/access rules." },
  { q: "What file types can be uploaded to an Event Gallery?", a: "Event Galleries accept JPEG, PNG and WebP images. Upload validation and Storage Rules enforce the supported image types, size limits and path/metadata contract." },
  { q: "How is Event Gallery access checked operationally?", a: "Stage 16 includes security regression tests plus audit and backfill tooling for gallery-access projections. This allows operators to identify incompatible or missing access data without weakening the runtime access rules." },
  { q: "Who can see the Activity Log?", a: "The Activity Log is read-only for authorised Group and administrator roles and records important administrative and leader actions. Entries cannot be edited or deleted from the website." },
  { q: "Why might I see fewer menu options than another leader?", a: "The Leader Portal is permission-aware. Available pages and actions depend on approved access level, assigned sections and Scouting role. Stage 17 groups only destinations the signed-in leader can use; route guards and backend rules remain authoritative." },
  { q: "How is the Leader Menu organised?", a: "The Leader Menu is grouped by task: Programme, People & Parents, Group Operations, Insights & Records and Administration, with Account & Help kept separately for profile, portal help, Parent Portal access and sign-out. Groups with no permitted destinations are omitted." },
  { q: "How does the Leader Menu work on mobile?", a: "On phones the task groups use one-at-a-time disclosure panels. The group containing the current route opens automatically when the menu is opened or revisited, so navigation stays aligned with the page the leader is using." },
  { q: "Can I use the Leader Menu with a keyboard?", a: "Yes. The menu trigger and disclosure controls use native buttons, active destinations expose the current-page state, mobile panels are labelled regions, and Escape closes an open menu and returns focus to the Leader Menu button." },
  { q: "Where is the organisational chart?", a: "The internal organisational chart is included on this Info & FAQ page so leaders can find organisational information and guidance in one place." },
  { q: "How does automatic sign-out work?", a: "Authenticated sessions use session-only Firebase persistence and inactivity sign-out. Parent and leader/admin inactivity limits are configurable by authorised administrators, with safe defaults retained when settings have not been changed." },
  { q: "How is production data protected?", a: "Firestore and Storage Rules are the security boundary. CI includes permission, compatibility and regression checks; live-data migrations and reconciliation are handled deliberately, and ambiguous incompatible records remain blocking findings rather than being silently rewritten." },
  { q: "How are backups and recovery handled?", a: "Firestore has documented backup/export and recovery procedures. Operational guidance also covers deployment identity, recovery checks and safe handling of production changes." },
  { q: "How is accessibility checked?", a: "Playwright includes accessibility and mobile regression coverage across representative public, parent and leader routes, including semantic structure, named controls, keyboard focus, current-route state, Escape focus restoration and horizontal-overflow checks." },
  { q: "How is test data kept stable?", a: "Automated tests use deterministic canonical seed contracts and emulator-backed transient records for workflows that should not pollute production or shared seed data." },
  { q: "What was delivered in Stage 14?", a: "Stage 14 consolidated architecture and operational hardening: architecture/RBAC documentation, source-complexity guardrails, pinned Playwright tooling, broader Firestore Rules triggers, WebKit smoke coverage, email Worker contract tests, recovery guidance and deployed build identity." },
  { q: "What was delivered in Stage 15?", a: "Stage 15 delivered Section Floats and secure receipts: an append-only finance ledger, role/section RBAC, reconciliation and safe correction foundations, secure attachments, receipt workflows, finance reports/exports and the final focused four-action float workflow." },
  { q: "What was delivered in Stage 16?", a: "Stage 16 delivered secure Event Galleries end to end: leader photo management, validated image storage, consent-aware parent access, completed-event lifecycle behaviour, accessibility/recovery hardening, security regression coverage and operational gallery audit/backfill tooling." },
  { q: "What was delivered in Stage 17?", a: "Stage 17 redesigned the Leader Menu around task-based groups, added compact route-aware mobile disclosures, kept RBAC-driven visibility intact, separated Account & Help actions, and added desktop/mobile and keyboard accessibility regression coverage." }
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
        <LeaderPageHeader title="Leader Portal Information" description="Current portal capabilities, organisational information, development status and frequently asked questions." />
        <Alert severity="success" sx={{ mb: 3 }}>
          Stages 1–17 are complete. The portal now includes Adventure Skills, Equipment & Stores, Section Floats with secure receipts, consent-aware Event Galleries and a task-based, route-aware Leader Menu alongside the established member, meeting, event, parent and reporting workflows. Future development should preserve the security, privacy, data-integrity, accessibility, recovery, seed-stability and Firestore/Storage efficiency safeguards already established.
        </Alert>

        <Typography variant="h4" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Organisational Chart</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>Internal organisational hierarchy, sections and reporting relationships for active leaders.</Typography>
        <Box sx={{ mb: 5 }}><OrganisationChartContent /></Box>

        <Typography variant="h4" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Development Roadmap</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 5 }}>
          {stages.map((stage) => (
            <Paper key={stage.number} variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderLeft: "5px solid", borderLeftColor: stage.status === "Current" ? "warning.main" : stage.status === "Complete" ? "success.main" : "secondary.main" }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Stage {stage.number}</Typography>
                <Chip label={stage.status} color={chipColor(stage.status)} size="small" variant={stage.status === "Planned" ? "outlined" : "filled"} />
              </Stack>
              <Typography variant="h6" sx={{ mt: 1.25, fontWeight: 700 }}>{stage.title}</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>{stage.summary}</Typography>
            </Paper>
          ))}
        </Box>

        <Typography variant="h4" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Frequently Asked Questions</Typography>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          {faqs.map((faq, index) => (
            <Accordion key={faq.q} disableGutters elevation={0} sx={{ "&:before": { display: "none" }, borderBottom: index < faqs.length - 1 ? "1px solid" : "none", borderColor: "divider" }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 700, color: "secondary.main" }}>{faq.q}</Typography></AccordionSummary>
              <AccordionDetails><Typography>{faq.a}</Typography></AccordionDetails>
            </Accordion>
          ))}
        </Paper>
      </Container>
    </Box>
  );
}
