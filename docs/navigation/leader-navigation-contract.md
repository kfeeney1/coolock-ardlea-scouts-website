# Canonical Leader navigation contract — SW-182

Generated from `src/navigation/leaderNavigation.ts`. Run `npm run document:leader-navigation` to update; `npm run check:leader-navigation-contract` rejects drift.

The runtime menu, canonical permission filter, redesigned category ordering, legacy redirect and history-aware record Back bridge consume this contract. Route and data guards remain independent.

## Category order

Existing: Dashboard → Programme → People & Parents → Treasurer → Secretary → Quartermaster / Bo’sun → Group Operations → Insights & Records → Administration → Account & Help.

Redesigned: Dashboard → Programme → People & Parents → Secretary → Quartermaster / Bo’sun → Group Operations → Treasurer → Insights & Records → Administration → Super Admin → Account & Help.

## Destinations

Permissions are ANY-of the listed canonical registry IDs, in addition to Leader portal access and any existing appointment/privileged constraints shown below. Stable page IDs identify navigation destinations; the identity column names the actual rendered marker or heading.

| Existing category / redesigned category | Stable ID | Navigation page ID | Canonical route | Permissions (ANY) | Appointment / privilege constraints | Rendered identity | Parent | Explicit in-app Back on landing |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard / Dashboard | dashboard | leader-dashboard | /leader | leader.portal.access | None | admin-overview | None | None; Dashboard navigation remains available |
| Programme / Programme | weekly-meetings | weekly-meetings | /leader/weekly | meetings.manage.section, weekly-meetings.manage.group | None | page-weekly-meetings | /leader | None; Dashboard navigation remains available |
| Programme / Programme | events-activities | events-activities | /leader/events | events.manage.section | None | heading: Events & Activities (h1) | /leader | None; Dashboard navigation remains available |
| Programme / Programme | group-polls | group-polls | /leader/polls | leader.portal.access | None | heading: Group Polls | /leader | None; Dashboard navigation remains available |
| Programme / Programme | badgework | badgework | /leader/badgework | badgework.manage.section, badgework.manage.group, badgework.read.group | None | heading: Adventure Skills Badgework (h1) | /leader | None; Dashboard navigation remains available |
| Programme / Programme | programme-equipment | programme-equipment | /leader/programme-equipment | equipment.loan.section | None | page-programme-equipment | /leader | None; Dashboard navigation remains available |
| People & Parents / People & Parents | member-management | member-management | /leader/members | members.read.section, members.read.group | None | page-member-management | /leader | None; Dashboard navigation remains available |
| People & Parents / People & Parents | join-management | join-management | /leader/join | join.manage | joinManagementOnly | page-join-management | /leader | None; Dashboard navigation remains available |
| People & Parents / People & Parents | consent-management | consent-management | /leader/consents | consent.manage.section | None | heading: Consent Management (h1) | /leader | None; Dashboard navigation remains available |
| People & Parents / People & Parents | event-consent | event-consent | /leader/event-consent | consent.manage.section | None | page-event-consent | /leader | None; Dashboard navigation remains available |
| People & Parents / People & Parents | parent-communications | parent-communications | /leader/communications | members.read.section, members.read.group | None | heading: Parent Communications (h1) | /leader | None; Dashboard navigation remains available |
| People & Parents / People & Parents | family-billing | family-billing | /leader/subs#family-billing | finance.manage.section, finance.manage.group | None | page-subs | /leader | None; Dashboard navigation remains available |
| Treasurer / Treasurer | treasurer-subs | treasurer-subs | /leader/subs?view=treasurer | finance.manage.group | Group Treasurer | page-treasurer-subs | /leader | None; Dashboard navigation remains available |
| Treasurer / Treasurer | treasurer-floats | treasurer-floats | /leader/finance?view=treasurer | finance.manage.group | Group Treasurer | page-treasurer-floats | /leader | None; Dashboard navigation remains available |
| Treasurer / Treasurer | treasurer-reports | treasurer-reports | /leader/reports?view=treasurer | reports.section | Group Treasurer | page-treasurer-reports | /leader | None; Dashboard navigation remains available |
| Treasurer / Treasurer | treasurer-settings | treasurer-settings | /leader/settings?view=treasurer | settings.subs.manage | Group Treasurer | page-treasurer-settings | /leader | None; Dashboard navigation remains available |
| Secretary / Secretary | secretary-meeting-records | secretary-meeting-records | /leader/meetings?view=secretary | meetings.manage.section, meeting-records.read.group | Group Secretary, Group Chairperson | page-secretary-meeting-records | /leader | None; Dashboard navigation remains available |
| Quartermaster / Bo’sun / Quartermaster / Bo’sun | qm-equipment-stores | qm-equipment-stores | /leader/equipment?view=quartermaster | equipment.manage | Group Quartermaster / Bo'sun, Group Quartermaster, Group Bo'sun, Group Bosun | page-qm-equipment-stores | /leader | None; Dashboard navigation remains available |
| Quartermaster / Bo’sun / Quartermaster / Bo’sun | qm-detailed-inventory | qm-detailed-inventory | /leader/equipment/inventory?view=quartermaster | equipment.manage | Group Quartermaster / Bo'sun, Group Quartermaster, Group Bo'sun, Group Bosun | page-qm-detailed-inventory | /leader/equipment?view=quartermaster | Back to Equipment & Stores → /leader/equipment?view=quartermaster |
| Quartermaster / Bo’sun / Quartermaster / Bo’sun | qm-equipment-issues | qm-equipment-issues | /leader/equipment/issues?view=quartermaster | equipment.manage | Group Quartermaster / Bo'sun, Group Quartermaster, Group Bo'sun, Group Bosun | page-qm-equipment-issues | /leader/equipment?view=quartermaster | Back to Equipment & Stores → /leader/equipment?view=quartermaster |
| Quartermaster / Bo’sun / Quartermaster / Bo’sun | qm-reports | qm-reports | /leader/qm-reports | equipment.manage | Group Quartermaster / Bo'sun, Group Quartermaster, Group Bo'sun, Group Bosun | page-qm-reports | /leader/equipment?view=quartermaster | Back to Equipment & Stores → /leader/equipment?view=quartermaster |
| Quartermaster / Bo’sun / Quartermaster / Bo’sun | qm-settings | qm-settings | /leader/settings?view=quartermaster | equipment.manage | Group Quartermaster / Bo'sun, Group Quartermaster, Group Bo'sun, Group Bosun | page-qm-settings | /leader | None; Dashboard navigation remains available |
| Group Operations / Group Operations | group-equipment-stores | group-equipment-stores | /leader/equipment?view=group-operations | equipment.read.group | None | page-group-equipment-stores | /leader | None; Dashboard navigation remains available |
| Group Operations / Group Operations | group-section-floats | group-section-floats | /leader/finance?view=group-operations | finance.manage.section, finance.manage.group | None | page-group-section-floats | /leader | None; Dashboard navigation remains available |
| Group Operations / Group Operations | group-subs | group-subs | /leader/subs?view=group-operations | finance.manage.section, finance.manage.group | None | page-group-subs | /leader | None; Dashboard navigation remains available |
| Group Operations / Group Operations | group-meeting-records | group-meeting-records | /leader/meetings?view=group-operations | meetings.manage.section, meeting-records.read.group | None | page-group-meeting-records | /leader | None; Dashboard navigation remains available |
| Insights & Records / Insights & Records | attendance-insights | attendance-insights | /leader/attendance | reports.section | None | heading: Attendance History & Insights (h1) | /leader | None; Dashboard navigation remains available |
| Insights & Records / Insights & Records | reports-exports | reports-exports | /leader/reports?view=insights | reports.section | None | page-reports-exports | /leader | None; Dashboard navigation remains available |
| Insights & Records / Insights & Records | activity-log | activity-log | /leader/activity | audit.read | activityLogOnly | heading: Activity Log (h1) | /leader | None; Dashboard navigation remains available |
| Administration / Administration | roles-permissions | roles-permissions | /leader/roles | leader.portal.access | None | heading: Roles & Permissions (h1) | /leader | None; Dashboard navigation remains available |
| Administration / Administration | leader-requests | leader-requests | /leader/requests | accounts.approve.leader | adminOnly | heading: Leader Requests (h1) | /leader | None; Dashboard navigation remains available |
| Administration / Administration | parent-access | parent-access | /leader/parent-access | parents.manage | adminOnly | heading: Parent Management (h1) | /leader | None; Dashboard navigation remains available |
| Administration / Administration | leader-access | leader-access | /leader/access | roles.manage.operational, roles.delegate.operational | leaderAccessOnly | heading: Leader Access & Organisation (h1) | /leader | None; Dashboard navigation remains available |
| Administration / Administration | settings | settings | /leader/settings | settings.session.manage, settings.subs.manage | settingsOnly | page-settings | /leader | None; Dashboard navigation remains available |
| Administration / Super Admin | system-information | system-information | /leader/system | system.superadmin.protect | superAdminOnly | heading: System Information (h1) | /leader | None; Dashboard navigation remains available |
| Account & Help / Account & Help | my-profile | my-profile | /leader/profile | leader.portal.access | None | heading: My Profile (h1) | /leader | None; Dashboard navigation remains available |
| Account & Help / Account & Help | info-faq | info-faq | /leader/info | leader.portal.access | None | heading: Leader Portal Information (h1) | /leader | None; Dashboard navigation remains available |
| Account & Help / Account & Help | parent-portal | parent-portal | /parent | leader.portal.access | None | heading: Parent Portal (h1) | None | None; Dashboard navigation remains available |

## History, deep links and explicit controls

For every destination: selecting a menu link replaces the transient menu entry. Browser Back (and browser-equivalent Android Back) first dismisses an open menu while staying on the same page; the next Back follows actual previous-route history. No fixed previous route is invented for a deep link or reload. Expanding a category adds no history entry. Active destination/category state is derived from the canonical pathname, query and fragment.

`inAppBack` describes the landing-route control; inline member/detail views, form steps and modal Back controls retain their own workflow state. `parentPath` is the logical parent, not a new automatic redirect. Pages without an explicit Back control keep that behavior. QM Reports, Detailed Inventory and QM Issues retain their existing fixed in-app returns to the Quartermaster Equipment & Stores context. Parent Portal is a separate account boundary, not a Leader subpage.

Active state is resolved once from the permission-filtered menu using stable destination and category IDs. Query order and additional filters do not change the active destination; the view parameter still distinguishes role workspaces. Specific fragment destinations take precedence, saved redirects resolve to canonical items, and unavailable items cannot supply an active parent. Both navigation versions use the same resolver.

Family Billing keeps its supported Subs fragment URL and renders `page-subs`; no distinct family-billing page marker or automatic fragment scrolling is claimed.

The existing record Back bridge consumes the following safe-parent map. With a previous route observed by the current app instance and valid in-app history, semantic Back/Return controls pop the observed history. Direct entry/reload retains the explicit parent link. Record edit/save confirmation guards remain authoritative; this map does not bypass them.

| Record prefix | Safe explicit parent |
| --- | --- |
| /leader/members/ | /leader/members |
| /leader/events/ | /leader/events |
| /leader/join/ | /leader/join |
| /leader/consents/ | /leader/consents |

Representative workflow exceptions remain explicit: Event Edit “Back to Event” targets its event detail under the unsaved-change guard; Save Event returns to the event list. Equipment detail “Back” targets Dashboard when entered from the Dashboard attention card, otherwise the equipment list; store-move returns to its equipment record. These are existing page controls, not generic browser-Back redirects.

## Supported saved links

| Legacy redirect | Canonical target |
| --- | --- |
| /leader/member-history | /leader/members |

Contextless workspace links remain valid independent routes without a redirect:

| Supported route | Rendered identity |
| --- | --- |
| /leader/equipment | page-equipment-stores |
| /leader/equipment/inventory | page-qm-detailed-inventory |
| /leader/finance | page-section-floats |
| /leader/subs | page-subs |
| /leader/reports | page-leader-reports |
| /leader/meetings | page-meeting-records |

## Assurance boundary

Playwright clicks the real destinations in both modes and checks canonical URLs plus the rendered identities. Independent role-workspace expectations remain in unit and existing route-identity tests so an incorrect cross-role mapping cannot silently update its own expected result. Firebase TEST manual acceptance (SW-189), physical Android system Back and Production Manual Testing remain separate. This contract is not a Production pass.
