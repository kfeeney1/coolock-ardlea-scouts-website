# Group Calendar (SW-335)

Calendar is independently controlled by Superuser Settings → Group Calendar.
The `siteSettings/calendarExperience` choice defaults to `existing` (disabled).
Only active Superusers can save it; all changes include actor and server time.
Do not enable live until the source integrations and live TEST acceptance pass.

## Delivery sequence

1. SW-339: default-off setting, canonical membership references, navigation,
   Monday-first monthly grid and URL month/type context. Merged in #904.
2. SW-336: canonical month-scoped meetings/events, authorised sections/destinations.
   Current work includes raw Leader records, existing shared Parent programmes,
   member-readable public events, live source updates and safe source details.
   **Not complete:** private selected/mixed-audience Parent event programmes lack
   an existing safe month-queryable source. Resolve this gap before enablement;
   do not substitute broad raw event reads or scan lifetime audience records.
3. SW-337: service appointment persistence, validated form, detail/update flow.
4. SW-338: appointments referencing existing canonical Maintenance tasks.

Each focused PR targets main. Integrations depend on foundations being on main;
do not merge into temporary feature branches. Source acceptance and PMT are not
established by the foundation's automated checks.

## Membership and Maintenance

Calendar uses the existing validated group membership union: active canonical
leader/admin/Superuser with a sections list, approved parent, or active member
linked to their account. An authenticated account alone is insufficient. The
`calendar/group/access/{uid}` document stores a source reference, never a grant.
Rules revalidate the source, reject foreign/broad access and revoke access when
the source or Calendar option changes. Calendar has one shared availability
provider, fails closed and supports retry without losing URL context.

Maintenance stays independent. Calendar enablement cannot permit reading tasks
or documents when Maintenance is disabled. Maintenance entry queries and actions
must additionally require existing Maintenance access. Existing task assignment,
documents and status stay in Maintenance; no copied editable tasks are allowed.

## TEST enablement and rollback

After all four children have passed development assurance, verify the exact main
build deployed to Firebase TEST. Sign in as a Superuser, enable Calendar in TEST
only, and exercise the epic's desktop/Android/accessibility/security scenarios.
Enable Maintenance separately only if its own live acceptance permits it.
Record evidence against each child and SW-335. Production Manual Testing is a
separate owner-recorded gate; retain pending Jira status until that passes.

Rollback: choose Calendar disabled in Superuser Settings. Live entry points and
the direct route become unavailable; canonical meeting/event/Maintenance data
are retained. No other rollout option is changed. Feature adds no new Google
APIs, Functions, paid calendar service or email dependency. Existing Firebase
services do not guarantee a zero total bill.

## Source queries and revocation

Calendar reads dates from canonical records and existing privacy-safe programme
projections; it writes no parallel calendar entries. Queries cover the displayed
Monday-to-Sunday grid: meetings by date, events starting in it plus events that
span into it. Deploy the checked-in composite indexes through the normal TEST
workflow, and wait for indexes to be ready before live acceptance.

Raw meeting/event reads remain scoped by existing Leader Rules. Parent reads use
current active children, rather than historical linkedSections, and existing safe
parentWeeklyMeetings/parentGalleryEvents. Member-only accounts retain public-event
source access. These paths do not grant access to private event audience records.
No source count or private record title is inferred from inaccessible records.

The membership reference alone does not provide live revocation notifications.
Calendar additionally observes canonical membership proof, own parent/organisation
scope and up to eight linked children. Changes clear stale month/detail results
and revalidate permitted scope; loss of one role rechecks the existing role union.
Canonical source forms own all edits. Calendar return context survives navigation
within the source record family; disabling Calendar removes those return links.

## Current TEST assurance blocker

Main deployment after #904 passed deployment but failed its Attendance Insights
stable smoke (SW-527). This is separate from Calendar's local/PR assurance.
Do not claim a live TEST pass or enable Calendar based on the published build.
