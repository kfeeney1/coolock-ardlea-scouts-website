import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Container,
  Paper,
  Typography
} from "@mui/material";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import OrganisationChartContent from "../components/admin/OrganisationChartContent";

type Capability = { title: string; summary: string };

const capabilities: Capability[] = [
  {
    title: "Members, parents and roles",
    summary: "Manage member records and section moves, approve and link parent access, maintain leader profiles and organisational roles, and publish only leaders who have opted in to the public Who’s Who."
  },
  {
    title: "Weekly meetings and programme",
    summary: "Plan, run, copy and close section meetings with attendance, programme items, notes, incidents, Adventure Skills work and equipment requirements. Reusable activities can be kept in the Programme Library."
  },
  {
    title: "Events, consent and attendance",
    summary: "Create and manage events, collect event consent, record attendance, complete events into protected history and use attendance insights across weekly meetings and events."
  },
  {
    title: "Adventure Skills and Badgework",
    summary: "Record competency progress for one or more young people, review per-child progress, manage awards and history, and give approved parents a read-only view of their linked children’s progress."
  },
  {
    title: "Equipment and stores",
    summary: "Track inventory, locations, stock status, checkout and return, incidents, history and planned requirements or reservations linked to meetings and events."
  },
  {
    title: "Section floats and receipts",
    summary: "Record section cash through an auditable ledger, reconcile floats, make traceable corrections and attach supported receipts where storage-backed attachments are available."
  },
  {
    title: "Event galleries",
    summary: "Authorised leaders can manage event photo galleries. Eligible approved parents can view appropriate event photos for linked children when gallery access and consent requirements are satisfied."
  },
  {
    title: "Reports, records and communications",
    summary: "Use scoped reports and exports, attendance insights, formal meeting records, leader communications and the activity log according to the access granted to the signed-in account."
  }
];

const faqs = [
  {
    q: "How does Parent Portal access work?",
    a: "Parents register or sign in with their own account. Once approved and linked to the correct children, they can see the parent-facing information and tasks available for those children, including permitted consent, event and Adventure Skills information."
  },
  {
    q: "Why might I see fewer options than another leader?",
    a: "The Leader Portal is role and section aware. Pages and actions are shown according to your approved account, assigned sections and Scouting role, so two leaders may legitimately have different menus and available actions."
  },
  {
    q: "How are members created and moved?",
    a: "Accepted Join Us enquiries can become member records, and authorised leaders can add existing members where needed. Members can be moved between sections or have their membership status updated while relevant history is retained."
  },
  {
    q: "How are consent and medical details handled?",
    a: "Authorised leaders can review consent status and the details needed for their role. Approved parents can review permitted consent information for their linked children. Sensitive details are kept within the appropriate restricted workflows rather than general member lists."
  },
  {
    q: "How do Weekly Meetings work?",
    a: "Leaders can create, plan, save, copy and close Weekly Meetings. The workflow can include attendance, programme activities, Adventure Skills work, equipment requirements, incidents and meeting notes. Closed meetings are retained as history with only the permitted correction workflows available."
  },
  {
    q: "Can I copy a Weekly Meeting?",
    a: "Yes. Copy Meeting creates a new meeting rather than overwriting the original. Reusable programme structure can be copied while attendance, completed outcomes, incidents and operational transactions are reset for the new meeting."
  },
  {
    q: "What is the Programme Library?",
    a: "The Programme Library lets leaders save reusable section activities, games and programme items and insert fresh copies into future Weekly Meetings."
  },
  {
    q: "Can I share a meeting plan with parents?",
    a: "Weekly Meetings can generate parent-safe sharing text for suitable programme information. Internal attendance, incident and operational stock details are not included in that parent-facing summary."
  },
  {
    q: "How does event consent work?",
    a: "When an open event requires consent, parents use the event-consent flow and authorised leaders can review responses and consent state while managing the event and attendance."
  },
  {
    q: "What happens when an event is completed?",
    a: "Events move through their operational lifecycle and completed events remain available as protected history. Attendance and required consent need to be resolved before completion, and an eligible gallery can remain available under its normal access rules."
  },
  {
    q: "Where can I see attendance trends?",
    a: "Attendance Insights provides Weekly Meeting, Event and Combined views with date filtering and per-member detail. Only attendance that has actually been recorded is used when calculating recorded-attendance rates."
  },
  {
    q: "How does Adventure Skills progress work?",
    a: "Leaders can select one or more young people, choose an Adventure Skill and stage, record individual competency progress and manage awards. Progress belongs to the member, so it remains with them when they move section."
  },
  {
    q: "Can parents see Adventure Skills progress?",
    a: "Yes. Approved parents can see read-only Adventure Skills competency and award progress for their linked children. Parent accounts cannot edit progress or award badges."
  },
  {
    q: "What is Equipment & Stores?",
    a: "Equipment & Stores covers inventory, categories, storage locations, checkout and return, unavailable stock, incidents, history, programme requirements, reservations and focused reports."
  },
  {
    q: "Who can manage equipment?",
    a: "Equipment access depends on the leader’s approved role and section scope. Group equipment roles can have wider inventory responsibility, while section leaders use the operational actions available for their authorised sections."
  },
  {
    q: "Can meetings and events reserve equipment?",
    a: "Yes. Weekly Meetings and Events & Activities can record planned equipment requirements and reservations, which can later be handled through the normal equipment workflow."
  },
  {
    q: "What are Section Floats?",
    a: "Section Floats tracks section cash through a transaction ledger. The normal workflow covers opening a float, topping it up, recording money out and closing it, with reconciliation and traceable correction support for authorised users."
  },
  {
    q: "How do receipts work?",
    a: "Where storage-backed attachments are available, a supported receipt image or PDF can be attached to an appropriate finance transaction either while recording it or from transaction history."
  },
  {
    q: "How are finance mistakes corrected?",
    a: "Finance history is preserved. Corrections use linked adjustment or reversal records rather than silently replacing the original transaction."
  },
  {
    q: "What is an Event Gallery?",
    a: "An Event Gallery is the photo area attached to an event. Authorised leaders can manage supported event images, and eligible approved parents can view appropriate gallery content for their linked children. Galleries are not a public website photo feed."
  },
  {
    q: "What reports are available?",
    a: "Reports & Exports covers member, event, attendance, consent and operational reporting within the signed-in user’s permitted scope. Equipment & Stores and Section Floats also provide focused reports and exports for their own workflows."
  },
  {
    q: "What are Meeting Records for?",
    a: "Meeting Records holds formal leader, Group Council and Group Leaders meeting notes, decisions and actions. It is separate from Weekly Meetings and retains authorised history when records are revised."
  },
  {
    q: "Who can see the Activity Log?",
    a: "The Activity Log is a read-only operational record available only to authorised group-level users. It records important administrative and leader actions and is not a general leader or parent page."
  },
  {
    q: "How is the Leader Menu organised?",
    a: "The Leader Menu groups destinations by task, including Programme, People & Parents, Group Operations, Insights & Records and Administration. Account and Help actions are kept separately, and groups with no permitted destinations are omitted."
  },
  {
    q: "How does the Leader Menu work on mobile?",
    a: "On smaller screens the menu uses compact disclosure panels and keeps the group containing the current route open so navigation stays aligned with the page you are using."
  },
  {
    q: "Where is the organisational chart?",
    a: "The internal organisational chart is included on this Information & FAQ page so active leaders can see the current organisational structure and reporting relationships available to them."
  },
  {
    q: "How does automatic sign-out work?",
    a: "Signed-in parent and leader sessions have inactivity handling. The configured timeout can differ by account type, so users may be asked to sign in again after a period without activity."
  }
];

export default function LeaderInfo() {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
      <Container maxWidth="xl">
        <LeaderDashboardHeader />
        <LeaderPageHeader
          title="Leader Portal Information"
          description="Current portal capabilities, organisational information and practical answers for day-to-day use."
        />

        <Alert severity="info" sx={{ mb: 3 }}>
          The portal supports the core public, parent and leader workflows used by the group today. Available actions depend on your approved role and section access; features that are not ready for operational use are not described here as available.
        </Alert>

        <Typography variant="h4" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>
          Current Capabilities
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 5 }}>
          {capabilities.map((capability) => (
            <Paper key={capability.title} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>
                {capability.title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                {capability.summary}
              </Typography>
            </Paper>
          ))}
        </Box>

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
          Frequently Asked Questions
        </Typography>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          {faqs.map((faq, index) => (
            <Accordion
              key={faq.q}
              disableGutters
              elevation={0}
              sx={{
                "&:before": { display: "none" },
                borderBottom: index < faqs.length - 1 ? "1px solid" : "none",
                borderColor: "divider"
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 700, color: "secondary.main" }}>{faq.q}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>{faq.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>
      </Container>
    </Box>
  );
}
