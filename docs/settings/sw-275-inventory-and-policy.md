# SW-275 — Settings inventory and proposed permission matrix

Prepared 6 November 2026. **P1 approved for implementation on 6 November 2026.** Preparation child: SW-580. Owner approved development after review of the P1 defaults and designs: “Commence then development”. Approval recorded on SW-580 and SW-275; implementation children SW-581–SW-588. Historical audit observations below describe the audited baseline, not completed implementation.

## Reconciliation and evidence boundary

Audited main `06cd86421929f899075c60904892b3d12448e90f` after fetching origin/main. Recent merges include #973 operations inventory, #972 backup evidence and #975 meeting reopen save settlement. Open PR search returned dependency updates #968 and #969; neither implements Settings policy. No AGENTS.md was found in the repository/workspace scan. No application code, configuration values, deployments or access records were changed.

SW-275 has no attachments, no comments and had no children before SW-580. SW-274 likewise has no approval comments. Jira search for SW-275/settings permissions/permission matrix and repository RBAC/navigation documentation found no agreed SW-275 matrix. SW-274 establishes a parallel governance process, not Settings permissions. Read SW-179 and SW-114 requirements; retain SW-114's completed status and PMT outcome. SW-164 remains paused, including its rollout and venue configuration.

Evidence below is repository behaviour, not a claim about currently deployed Rules or populated live records. Paths refer to this exact commit and can be opened at `https://github.com/kfeeney1/coolock-ardlea-scouts-website/blob/06cd86421929f899075c60904892b3d12448e90f/<path>`.

## Approved requirements versus observations versus proposals

| Class | Source | Meaning |
| --- | --- | --- |
| Explicit requirement | SW-275 | Agree menu, view, scope, edit and destructive permissions before broad implementation; backend enforcement and representative PMT required. |
| Explicit requirement | SW-179 | Permission-filter each destination; omit empty categories; union appointments; preserve header/emblem and direct-route protections. |
| Explicit requirement | SW-111 | Leader baseline plus all valid appointments; no implicit Admin promotion; scope and removal enforced. |
| Explicit requirement | SW-49, SW-50 | DGL mirrors GL; GL may delegate within protected system-role limits. |
| Explicit requirement | SW-370 | Treasurer Settings excludes session controls; retain authorised administration session controls. |
| Explicit requirement | SW-129 | Family Billing Accounts belongs under People & Parents; preserve financial permissions/history. |
| Explicit requirement | SW-114 | Operational details restricted to Super Admin/explicitly authorised operators; no client provider credentials or automatic purchasing. |
| Observation | Code/Rules below | Implemented grants and discrepancies; do not treat them as owner approval. |
| Proposal | Matrix and decisions below | Conservative defaults, explicitly awaiting owner approval. |

## Inventory

Abbreviations: SA = Super Admin system role; A = Admin; GL = Group Leader or Deputy Group Leader; T = Group Treasurer; Q = Group Quartermaster / Bo'sun; L = active canonical Leader-system account. Appointments do not replace system roles. Every current frontend appointment check must be read alongside the backend discrepancies below.

| ID / control | Route, component, data | Current navigation / frontend visibility and view/edit | Authoritative enforcement, scope and high-impact actions | Disagreement / boundary |
| --- | --- | --- | --- | --- |
| S01 Session timeouts | `/leader/settings`; `pages/SiteSettings.tsx`, `services/siteSettings.ts`; `siteSettings/session`: parent, desktop and phone inactivity minutes | Group Operations Settings; A/SA can edit; excluded from Treasurer/QM views | `firestore.rules:2343`: any signed-in identity can get; A/SA create/update with bounds 5–240 and audit fields; list/delete denied. System/group configuration | Consumption read is broader than settings-management route. Preserve timeout values and runtime consumption. |
| S02 Public Parent Login | Same route; SiteSettings; `siteSettings/parentLogin` and `publicNavigation.parentLoginEnabled` | SA panel only; switch saves transactionally | Canonical get and create/update SA; projection public get; canonical/projection consistency via getAfter; no delete | Public projection is intentional consumption, not permission to administer parent accounts. |
| S03 Parent consent entry points | Same route; SiteSettings; `parentConsent`, `publicNavigation.parentConsentEnabled` | SA only; switch | Same SA canonical/public projection split; transaction consistency; delete denied | Disabling presentation must not delete consent/medical records or weaken relationship checks. |
| S04 Leader navigation version | Same route; `LeaderNavigationSettings`; `siteSettings/leaderNavigation` | SA through `settings.leader-navigation.manage` | Signed-in get; SA create/update, version enum and actor/time validation; no delete | Presentation toggle never governs security. |
| S05 Schedule tiles version | Same; `ScheduleExperienceSettings`; `scheduleExperience` | SA on main Settings only | Same signed-in read/SA mutation schema as S04 | Separate persistent setting. |
| S06 Meeting workflow version | Same; `MeetingExperienceSettings`; `meetingExperience` | SA | Same boundary; editor pins chosen workflow during editing (`useMeetingExperience`) | Pinning layout cannot pin obsolete permissions. |
| S07 Attendance matrix version | Same; `AttendanceExperienceSettings`; `attendanceExperience` | SA | Same boundary | Do not infer attendance report access from toggle access. |
| S08 Maintenance version | Same; `MaintenanceExperienceSettings`; `maintenanceExperience` | SA | Signed-in get; SA create/update with `sdkRevision:1`; no delete | Runtime membership and document rules remain independent. |
| S09 Calendar version | Same; `CalendarExperienceSettings`; `calendarExperience` | SA | Signed-in get; SA schema-validated create/update; no delete | Calendar consumption differs from management. |
| S10 Leader training version | Same; `LeaderTrainingExperienceSettings`; `leaderTrainingExperience` | SA | Signed-in get; SA create/update; no delete | Training records themselves are operational records, not settings. |
| S11 Badgework version | Same; `BadgeworkExperienceSettings`; `badgeworkExperience` | SA | Signed-in get; SA create/update; no delete | Preserve parent/leader badgework protections. |
| S12 Hall feature switch | Same; `HallHireSettings`; `hallHire`, `hallHirePublic`, `hallHireReadiness`; venue `hallHireVenue` | SA; readiness gates enable action | SA canonical; public boolean/readiness projections; enable requires ready hall state and paired projection. Venue public only if confirmed/schema-safe; no general client venue write branch | Inventory only. SW-164 pause prohibits rollout, readiness or venue changes. No blanket SA bypass of Council booking policy. |
| S13 Scout year / rate policy | `/leader/settings` and `?view=treasurer`; `SubsSettingsPanel`; `subsRatePolicies` period/start/end/version and standard/leader family-size rates | T/GL/A/SA edit/create; Treasurer menu also appointment-filtered; main Settings contains same panel | `firestore.rules:1598`: all L read; finance authority create validated immutable policies; update/delete denied | Policy read broader than Settings route. Current UI has no separate view-only panel. GL may reach generic Settings rather than Treasurer context. |
| S14 Family classification/billing | Embedded in SubsSettingsPanel, `SubsFamilyAccountPanel`; `subsAccounts`, `subsAssignments`; related `/leader/subs` | T/GL/A/SA; rate panel embeds account creation/classification | Finance authority; accounts immutable create-only; corrections supersede rather than overwrite; assignments have separate validated rules | Conflicts with SW-129's explicit information architecture; keep records/permissions and reuse existing components when moving. Do not classify payments as configuration. |
| S15 Equipment categories | `/leader/equipment`, `/leader/equipment/inventory`; `EquipmentOptionManager`, `services/equipment.ts`; `equipmentCategories` | Equipment & Stores; manage controls Q/GL/A/SA; L consumes category names | `firestore.rules:1899`: L read, `canManageEquipment()` create/update/delete with actor/schema checks; group scope | UI resolver sees active appointment union; backend Q/GL predicates use scalar legacy role. UI checks category use before deletion; Rules delete is only authority check, so reference integrity needs explicit test/decision. |
| S16 Stores/locations | Same components/routes; `equipmentLocations` | Same equipment manage controls | `firestore.rules:1917`: same CRUD boundary; group-wide | Same union/reference gap. Store moves and equipment archive are operational record actions, separately protected. |
| S17 QM Settings placeholder | `/leader/settings?view=quartermaster`; SiteSettings | Q/GL/A/SA route; contextual QM menu; page says No current settings | No configuration/data action; no backend collection | Empty destination remains visible; proposal removes menu destination and retains safe legacy link handling. S15/S16 remain in Equipment & Stores. |
| S18 Leader appointments/sections | `/leader/access`, `/:leaderUid`; `LeaderAccessManagement`, `leaderDelegationPolicy`, `services/leaderAccess.ts`; `adminUsers`, `organisationLeadership`, `publicLeadership` | Leader Access; GL constrained delegation, A/SA ordinary access management; SA Admin promotion | `firestore.rules:357,2065,2094`: protected account transitions, cannot self-delegate GL authority, no account deletion, directory invalidation required; group administration with explicit target limits | Client considers appointment union; `canDelegateLeaderTarget` uses scalar GL predicate. Registry describes capability but cannot enforce data scope alone. |
| S19 Approval/link configuration | `/leader/requests`, `/leader/parent-access`; access components/services; registration requests, `parentAccounts`, leader-child relationships | A/SA approval and link management | `firestore.rules:395,430,443`: parent may create pending own request/get own account; A updates approved links/status; parent account delete denied | Parent self-service does not grant relationship editing; preserve dual leader/parent relationship requirements. |
| S20 Organisation/public leadership | `/leader/organisation` read view; edit/publication in Leader Access; `organisationChart.ts` | Organisation view L; edits use restricted access workflow | Private org L read; Admin writes/deletes; GL limited target changes; public projection schema excludes technical system roles/private contact; public read filtered opt-in | Publication/deletion narrower than ordinary org reads; preserve target limits and public opt-in. |
| S21 Own leader profile | `/leader/profile`; LeaderProfile; own `adminUsers` displayName/mobile; assigned sections/role displayed | Leader account menu; own details editable, role/sections not self-granted | `firestore.rules:357` own update limited to displayName/mobileNumber; no delete; role/scope edits use S18 | Rover membership and personal consent are operational self-service records, retain their distinct rules. |
| S22 Own theme preference | Leader header/menu `LeaderDashboardHeader`, `themePreference`, `ThemeExperienceProvider`; own `adminUsers.uiTheme` plus local cache | SA-only Look & feel | Own SA update enum only; no authority over another user's theme. Cache is not an access boundary | This is personal preference despite affecting appearance across routes. No proposal to expose to all roles. |
| S23 Policy document publication | `/policies`, `/leader/policies`; PolicyDocuments, `policyDocuments.ts`; Firestore `policyDocuments`, Storage PDFs | Read by document audience; publish/update/withdraw GL/A/SA | `firestore.rules:271`; Storage policy-document audience and manager rules; immutable versions, 10 MiB PDFs, no metadata delete; withdrawal retained | Group policy configuration with public impact; viewing a published policy never grants publication rights. |
| S24 Maintenance leader directory | Main Settings Maintenance panel; `maintenanceDirectoryStore.ts`; `maintenance/group/config/leaders`, `/leaders/*` | SA panel refresh action; reads consumed in maintenance | Rules allow Admin publish validated directory, canonical-source writers invalidate only; eligible maintenance members get directory; no arbitrary delete/reset | UI narrower than backend Admin publication. Fresh generation/expiry protects changing assignments. Proposal aligns explicit admin repair access without rollout authority. |
| S25 System/monitoring | `/leader/system`; SystemInformation, operational health services; `operationalMonitoring` | SA only read | `firestore.rules:2142`: SA get/list, all client writes denied; trusted deployment/service publication | No browser threshold editor exists. Provider limits/manual metadata are operational deployment inputs. Preserve SW-114 and SW-242 separation and PMT. |
| S26 Email/notification policy | No persistent settings editor in `/leader/communications`; `communicationLogic.ts`, email-worker config/source and workflow deployment | Communication templates selected per message; no policy menu or saved-template editor | Server environment controls sender/reply-to/admin recipients, delivery mode, origins, reminder interval, secrets; backend verifies actor and recipients | Deployment/service authority, not ordinary communication permission. Do not add provider API calls or editable secrets. |
| S27 Group/site/public content & sections | No runtime editor found; `publicSiteContent/live`, `TEST_site`, code content/config and public projection services | Public consumers; no authenticated content Settings destination | `firestore.rules:2417`: public get only validated published/TEST projection; list and all client mutation denied. Trusted publishing/deployment controls group identity, public text, section metadata | No invented Group Settings or section-settings CRUD page. Changes need existing publish pipeline and TEST/PROD separation. |
| S28 Meeting/event persistent defaults | Weekly/event routes; `programmeLibrary` reusable templates; default activities/badgework in `weeklyTrackerLogic.ts`; per-meeting/event policy flags | Programme feature pages; L assigned sections; GL group programme authority; A/SA permitted by rules | Programme library scope in `firestore.rules:1476`; per-record event/weekly flags enforced under their own collections; fixed default counts are source configuration | Reusable templates are persistent configuration-like records; individual meeting plans/consent requirements are operational record edits, not global settings grants. No independent runtime default-count editor found. |

No additional persistent user preference store was found beyond theme; meeting-copy sessionStorage is an unsaved draft, session activity storage is security bookkeeping. Account password recovery remains Firebase Auth self-service, not an administrative reset grant. Maintenance tasks/appointments, leader training dates, member leadership classifications, polls, attendance, payments and individual event consent choices remain operational records. Inventory includes their feature switches and shared templates without silently redefining their existing access policies.

## Approved matrix — P1

Each cell is a **management destination** permission, independent of runtime consumption. `—` = menu hidden, direct management view denied, no edit/create/delete/reset. `R` = menu shown, read-only management view, group scope, no mutations. `E` = menu shown, view/edit/create within the cell's scope; delete/reset is separately restricted below. `D` = menu/view plus constrained delegation only. `O` = own identity only. `U` = union of each valid grant and its own scope, deduplicated; never convert one section grant to group-wide. No new R oversight grants are proposed by default.

Columns: Session S01; Switches S02–S12; Finance S13–S14; Stores S15–S16; Access S18–S19; Publish S20/S23; Repair S24; System S25; Self S21/S22. All E cells are group-wide except O; A/SA access administration has target restrictions. Public/read-consumption exceptions below remain separate.

| System role / active appointment | Session | Switches | Finance | Stores | Access | Publish | Repair | System | Self |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Super Admin | E | E, hall paused | E | E | E, protected | E | E | R | O, theme allowed |
| Admin | E | — | E | E | E, no promotion | E | E | — | O, no theme edit |
| Leader + Group Leader | — | — | E | E | D | E for policies; restricted leadership publication | — | — | O |
| Leader + Deputy Group Leader | — | — | E | E | D | Same as GL | — | — | O |
| Leader + Group Treasurer | — | — | E | — | — | — | — | — | O |
| Leader + Group Quartermaster / Bo'sun | — | — | — | E | — | — | — | — | O |
| Leader + Group Secretary | — | — | — | — | — | — | — | — | O |
| Leader + Group Chairperson | — | — | — | — | — | — | — | — | O |
| Leader + Group Youth Champion | — | — | — | — | — | — | — | — | O |
| Leader + Group Trainer | — | — | — | — | — | — | — | — | O |
| Leader + Section Leader | — | — | — | — | — | — | — | — | O |
| Leader + Assistant Section Leader | — | — | — | — | — | — | — | — | O |
| Leader + Programme Scouter | — | — | — | — | — | — | — | — | O |
| Leader + Scouter / no appointment | — | — | — | — | — | — | — | — | O |
| Multiple valid appointments | U | U | U | U | U | U | U | U | O |
| Approved Parent / Guardian only | — | — | — | — | — | — | — | — | Own Auth recovery; linked-record self-service only |
| Member-only identity | — | — | — | — | — | — | — | — | No new Settings destination |
| Public / pending / inactive | — | — | — | — | — | — | — | — | Existing public reads and Auth recovery only |

An Admin or SA who also has appointments unions system-role grants with valid appointment grants. Parent/Leader dual identities keep explicit approved member links; SA does not automatically acquire parent consent authority. Inactive Leader grants are removed independently of any still-valid parent relationship.

### Read/section and destructive-action overlays

| Area | Open/read consumption and scope | Edit/create/delete/reset restrictions proposed |
| --- | --- | --- |
| Settings menus | Show each authorised settings area once using stable IDs and SW-179 style; open route requires a view grant | No Settings category if all children hidden; omit empty QM placeholder; legacy deep link gets clear safe empty/denied handling without loading finance. |
| Runtime settings | Signed-in session/presentation reads; public safe navigation/hall projections remain consumable | No management-menu grant follows from runtime reads. No document delete/reset for S01–S12. Saving an explicit supported value uses E authority, not a reset endpoint. |
| Finance | Keep all-active-Leader rate-policy reads used by operational workflows, while finance management route remains T/GL/A/SA | Create immutable policy versions only; no overwrite/delete/reset. Classifications correct through existing audited superseding workflow. No group financial access from Chairperson/Secretary titles. |
| Equipment | Active Leaders read group categories/Stores for authorised operations; management route/controls restricted Q/GL/A/SA | Create/rename allowed; recommend delete only unused category/Store, enforced authoritatively as well as UI; in-use rename must preserve record references/history. No bulk reset. This is a proposed tighter condition. |
| Appointments / accounts | GL delegation group-wide only to other ordinary Leader accounts and existing delegable appointments; Admin ordinary activation/sections; SA non-SA Admin transitions | No self-escalation; no Super Admin creation/mutation through generic access editor; no account hard delete/reset; parent link/approval A/SA only. Apply current target and field allowlists. |
| Organisation/public policy | Leader reads internal org; published policy readers follow public/authenticated/parent/leader/admin audience | Policy publisher GL/A/SA; leadership publishing A/SA, GL existing restricted delegation only. Preserve opt-in, immutable document versions and audited withdrawal; no widening from read access. |
| Programme templates | L view/create/edit/delete only assigned authorised sections; GL group programme authority; system-role overrides only as established | Template deletion affects template only, never historic meetings. Section Leader/Assistant/Programme Scouter/Scouter share existing assigned-section baseline; titles grant no global default editor. No new section configuration resource. |
| Maintenance directory | Existing member consumers retain minimal directory; propose explicit A/SA repair destination | Refresh derived projection only, schema/source/generation validated; never editable arbitrary membership; rollout remains SA. No reset/delete of tasks/documents. |
| Self-service | Own leader name/mobile; SA own theme; approved parent reads own account/linked records; existing member maintenance membership only | No self-appointment/section/link edit; Firebase Auth recovery stays own identity. No new parent/member global Settings. |
| Deployment-only configuration | Group identity/content, section catalogue, email sender/templates/reminder policy, operational thresholds, service credentials | No application CRUD destination or role grant introduced; repository/service deployment controls remain authoritative. Future editor requires a separately reviewed policy. |
| Hall | Existing Council booking policy remains distinct from settings | SW-164 pause unchanged; no activation, provider work, venue publication or booking-policy changes in SW-275. |

## Gap analysis

1. **Backend appointment evaluation is inconsistent.** `firestore.rules:40–48,96–109` uses legacy scalar roles for GL/Secretary/Q; finance `:121–130` checks array slots 0–3 and `active`, but no effective dates. Client `scoutingAppointments.ts` evaluates effective dates and normalised assignments; schema permits up to 12. Storage also uses scalar predicates. Can cause both denied valid unions and retained obsolete access. Fix through shared canonical policy semantics, not wider generic Admin checks; test position 5/12, expired/future and mixed legacy/current assignments.
2. **No view/edit separation in current settings panels.** Route predicate and Subs panel primarily test manage capabilities; registry declares only a few Settings IDs. Introduce explicit per-area view/mutate capabilities after P1 approval; do not invent read-only oversight now.
3. **Menu/route identities differ.** Finance appears in generic and Treasurer contexts; QM has an empty destination; contextual appointment filters can differ from underlying capability. Deduplicate settings resources without duplicating configuration or breaking saved links.
4. **Family Billing remains embedded.** SubsSettingsPanel renders SubsFamilyAccountPanel, contrary to SW-129 location requirement. Reconcile existing `/leader/subs` flow before adding any route; preserve immutable account history.
5. **Administrative repair mismatch.** Maintenance panel is SA-gated but Rules authorise Admin publication. Explicit P1 choice needed to expose repair to Admin or tighten Rules to SA; recommendation retains existing Admin backend authority with clear UI.
6. **Deletion/reference integrity differs.** `equipment.ts` checks option use in application service, but direct Rules delete checks authority only. Recommendation makes unused-only deletion authoritative; investigate existing reference/name storage before choosing a minimal implementation.
7. **Session freshness needs coverage.** AdminAuthProvider loads profiles/appointments using document reads rather than a general continuous permission subscription. Backend checks must reject revoked writes; UI should promptly remove protected content/drafts on revocation, expiry or section change. Layout pinning is not permission pinning.
8. **Documentation catalogue drift.** `scoutingAppointments.ts` includes Group Trainer; `CURRENT_SCOUTING_APPOINTMENTS` in permissionRegistry and roles documentation omit it. Canonical role coverage must use the actual catalogue.
9. **Tests are split.** SiteSettings Rules unit tests assert source shape, not emulator access outcomes. Existing navigation and domain Rules suites are useful foundations but do not establish a complete agreed Settings matrix.

## Focused child-ticket plan (proposed; create implementation children after approval)

| Order | Focus | Independently testable acceptance criteria |
| --- | --- | --- |
| 0 — SW-580 | Inventory, proposal and decision record | This inventory, P1 matrix, gaps, owner decisions and source SHA stored; never mark matrix approved without owner's explicit response. |
| 1 | Canonical Settings capabilities and appointment boundaries | Approved per-area view/mutate grants; canonical role coverage including Trainer; all valid assignment slots/effective dates/scopes; unit tests for no grant, union, removal and protected overrides; reconcile Firestore/Storage predicates used by Settings. |
| 2 | Settings navigation and direct routes | Stable IDs, unique destinations, no empty QM/Settings category; legacy URLs handled; view-only does not render mutation controls; mobile/keyboard/screen-reader tests in both navigation presentations. |
| 3 | System/session/feature configuration | Separate view/write guards, authorised runtime reads, projection consistency, bounded validated writes; no delete/reset; persisted values retained; hall paused. Emulator denial tests and persistence regression. |
| 4 | Finance settings and billing placement | Approved T/GL/A/SA management; rate consumption unaffected; immutable versions and corrections retained; Family Billing uses People & Parents and existing implementation. Test direct reads/writes, saved policy, multi-role T and unrelated sections. |
| 5 | Equipment configuration and high-impact actions | Approved manager union; ordinary Leader consumer read; unused-only delete policy enforced at data boundary with race-aware reference handling; no loss of historic records; authorised and denied CRUD tests. |
| 6 | Access/publication/maintenance repair | Existing delegation/approval/publication ceilings; no self-escalation or SA mutation; A/SA directory repair decision applied; generation invalidation and public opt-in preserved. Denied field/target writes and directory expiry tests. Split into separate Jira/PRs if scope exceeds one focused change. |
| 7 | Revocation and cross-area regression | Active-session role/appointment/scope changes remove content and block pending writes; assignment expiry, multi-role union and denied routes covered; no cached unauthorised data. Keep independent backend tests alongside UI tests. |
| 8 | TEST acceptance and PMT handoff | Record exact deployed TEST SHA/rules and representative accounts, authorised/denied/view-only/scoped CRUD workflows; separate CI, live TEST and PMT fields. Owner PMT required before epic Done. No PRODUCTION deployment. |

All implementation children target latest main, one Jira per focused PR, no merges. No new service, subscription, scheduled workload or privileged provider API collection. Expected additional cost for this preparation is zero infrastructure cost. Implementation should reuse existing document reads/listeners, keep queries scoped, and assess any incremental live subscription/Rules lookup count in its PR.

## Verification completed and remaining

Ran existing unit suites `permissionRegistry`, `scoutingAppointments`, `leaderNavigationPermissions`, `siteSettingsRules`: **22 passed, 0 failed** on audited SHA. These verify client role/appointment composition, expiration, menu filtering and Rules-source contracts. They are not emulator proof of backend policy, not a CI gate result and not a TEST/PMT pass. Existing meaningful follow-up foundations: `tests/firestore/subs.rules.test.mjs`, `leader-delegation.rules.test.mjs`, `deputy-group-leader-parity.rules.test.mjs`, `equipment-loans.rules.test.mjs`, `organisation.rules.test.mjs`, `policy-documents.rules.test.mjs`, `operational-monitoring.rules.test.mjs`, maintenance Rules suites, equivalent Storage suites and `e2e/leader-navigation-direct-routes.spec.ts`.

No application changes or PRs created. Full Quality/Playwright gates and live Firebase TEST verification are pending approved implementation; no new PMT result recorded. Implementation coverage must explicitly include allowed/denied reads and writes, view-only mutation rejection, own/assigned/group boundaries, create/delete/reset, empty menus, permission revocation and configuration persistence.

## Consolidated owner review

Approve **P1** as a whole, or specify exceptions to these four defaults:

1. **Keep management narrow:** SA system switches/monitoring; A/SA session and account administration; GL/DGL/T finance; GL/DGL/Q equipment; existing GL/DGL constrained delegation and policy publication. No extra Settings management or oversight rights for Chairperson, Secretary, Trainer or other titles. Existing operational consumer reads and section programme templates remain available.
2. **High-impact limits:** no hard reset/delete for system settings, accounts or immutable finance; equipment option deletion only when unused; retain policy withdrawal/history and protected delegation limits.
3. **Navigation:** omit empty QM Settings, expose only authorised functional settings once, and move embedded Family Billing operations to People & Parents using the existing implementation.
4. **Maintenance repair:** allow Admin and SA to refresh the derived leader directory, matching current backend authority; keep all feature rollout switches SA-only and Hall Hire paused.

Approval authorises this specific proposed matrix, not a blanket expansion of access or a PRODUCTION deployment. Any requested exception should identify area, role, scope, view versus edit and destructive authority; record the final decision on SW-580 and SW-275 before implementation branches are created.
