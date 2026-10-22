# Group Calendar (SW-335)

Calendar is independently controlled by Superuser Settings → Group Calendar.
The `siteSettings/calendarExperience` choice defaults to `existing` (disabled).
Only active Superusers can save it; all changes include actor and server time.
Do not enable live until the source integrations and live TEST acceptance pass.

## Delivery sequence

1. SW-339: default-off setting, canonical membership references, navigation,
   Monday-first monthly grid, URL month/type context. Foundation only: no source
   entries loaded yet; the screen explicitly reports integration is pending.
2. SW-336: canonical month-scoped meetings/events, authorised sections/destinations.
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
