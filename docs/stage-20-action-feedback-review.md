# Stage 20.5 — Action confirmation and feedback

## Scope

Stage 20.5 reviews high-impact operational actions so confirmation, success and failure feedback is predictable and accessible without changing authorization, data semantics, audit requirements or server-side validation.

The first implementation slice covers **Parent Access revocation** because revoking an approved account immediately removes all linked member and section access. The second covers **Leader Access & Organisation** where one save can alter account activation, system role, permitted sections or public organisation visibility. The third covers **Event lifecycle completion**, where completing an event moves into read-only history. The fourth covers **Member Management status transitions**, where changing Active, Inactive or Left status creates a lifecycle-history event and changes the member's operational state. The fifth covers **Join Us enquiry conversion**, where an accepted enquiry creates a persistent active member record and links that record back to the enquiry. The sixth covers **Leader Registration request decisions**, where approval creates section-scoped operational access and rejection closes the pending request. The seventh covers **Parent Access approval and rejection**, where approval grants selected-child access and can link existing consent records while rejection closes the access request without granting access. The close-out audit then identified six legacy browser-native dialog calls that had not been captured by the earlier source search; the eighth slice removes four of those six outside Badgework, and the ninth removes the final two Badgework confirmations.

## Action feedback contract

High-impact actions should follow these rules where applicable:

- destructive, revocation or access-removal actions should use an accessible in-app confirmation rather than a browser-native prompt;
- confirmation copy should identify the action and explain its immediate consequence in plain language;
- the safe/cancel path must leave persisted data unchanged;
- the destructive action should remain visually and semantically distinct from the safe path;
- success and failure feedback should remain visible in the page context after the action completes;
- existing audit events, permission checks and service-layer validation must remain authoritative;
- confirmation UI must not weaken role restrictions, broaden record scope or bypass guarded server-side behaviour.

## First slice — Parent Access revocation

The Parent Access screen already required a confirmation before revoking an approved parent account, but used `window.confirm`. That prompt is browser-native, has limited styling/accessibility control and is inconsistent with the rest of the MUI application.

This slice:

- replaces the browser-native revoke prompt with a labelled MUI dialog;
- names the affected parent in the dialog;
- explicitly states that linked children and sections are cleared immediately while the account and historical records remain intact;
- provides separate **Cancel** and destructive **Revoke Access** actions;
- preserves the existing `updateParentAccess(..., "revoked")` operation, audit event, success alert, failure alert and reload behaviour;
- extends deterministic Playwright coverage to open and cancel the in-app confirmation without mutating the seeded approved account.

## Second slice — Leader Access & Organisation

The Leader Access & Organisation screen already exposes one **Save Leader** action for both routine organisation-chart edits and access-affecting changes. Before this slice, deactivating an account, changing its system role or permitted sections, or changing public Who's Who visibility could be persisted with the same immediate save interaction as a title or display-order edit.

This slice keeps the ordinary save path lightweight while adding explicit review when the draft differs from the last loaded record in an access-affecting field:

- account activation/deactivation;
- system role;
- permitted account sections;
- public Who's Who visibility, including removal caused by changing away from the Leader role.

The confirmation dialog identifies the affected leader and lists the specific consequences detected before the service call runs. **Cancel** closes the dialog without persisting the draft; a later **Refresh** restores the last loaded values. Routine organisation-only edits such as scouting title, organisation section, display order and reporting line continue to use the existing direct save flow.

The existing `updateLeaderAccess` service, Super Admin-only role selector restriction, super-admin account safeguards, audit event, success/error alerts and organisation/public projection sync remain authoritative. Deterministic Playwright coverage uses the existing private multi-section leader fixture, stages a deactivation, verifies the review dialog, cancels it and refreshes to prove no persisted change occurred.

## Third slice — Event lifecycle completion

An existing event can move through its lifecycle to **Completed** from the event editor. Completion is materially different from an ordinary event edit: after the service accepts the transition, the event moves into history and its event details, roster changes and equipment changes become read-only while attendance viewing, reports, exports and gallery access remain available.

The editor already showed an inline warning when **Completed** was selected, but **Save Event** immediately called the existing update path. This slice adds a final review step before that service call:

- selecting **Completed** and pressing **Save Event** changes the existing editor into an accessible **Complete this event?** confirmation step;
- the confirmation names the event and explains that it will move into read-only history;
- **Cancel completion** returns to the editable draft without persisting anything;
- **Complete Event** invokes the existing save callback and therefore the existing `updateEvent` service;
- ordinary event edits and event creation keep their existing direct-save behaviour;
- existing lifecycle-transition validation, attendance/consent close-out checks, projection updates, audit event and success/error feedback remain authoritative;
- deterministic Playwright coverage stages completion of the existing open Beavers event fixture, cancels it, closes the editor and refreshes to prove the event remains Open and editable.

## Fourth slice — Member status transitions

The Member Management editor uses the same **Save Member** action for ordinary contact/detail edits, section changes and transitions between **Active**, **Inactive** and **Left**. The existing member service already treats a status transition as lifecycle history and audits it, but before this slice the UI persisted that operational-state change immediately with the rest of the draft.

This slice adds explicit review only when the status differs from the last saved member record:

- **Active**, **Inactive** and **Left** transitions all require a labelled **Confirm member status change?** review before `updateMember` is called;
- the confirmation identifies the member, shows the previous and proposed status, and explains the consequence of the target state;
- moving to **Inactive** or **Left** explicitly explains that the member record and lifecycle history are retained;
- returning to **Active** explains that the member returns to active status in the register;
- **Cancel status change** returns to the editable draft without persisting it, so the leader can revise or abandon the change;
- ordinary contact/detail edits and section-only changes keep the existing direct-save path;
- member creation keeps its existing flow and does not add a redundant status confirmation;
- the existing `updateMember` service remains responsible for section permissions, atomic member-history writes and audit events;
- deterministic Playwright coverage stages an existing active seeded member as **Left**, cancels the review, closes the editor and refreshes to prove the member remains Active.

## Fifth slice — Join Us member conversion

An accepted Join Us enquiry can be converted into a member with **Create Member Record**. The existing conversion path already re-checks the live enquiry inside a Firestore transaction, refuses conversion unless the enquiry is still **Accepted**, refuses duplicate conversion, creates the new member as **Active**, and links the new member ID back to the enquiry. Before this slice, the UI relied on browser-native `window.confirm` before invoking that service.

This slice moves that action onto the same in-app review contract:

- **Create Member Record** now opens an accessible **Create member record?** dialog instead of a browser-native prompt;
- the confirmation identifies the child and explains that a persistent Active member record will be created in the enquiry's section and linked back to the accepted enquiry;
- the confirmation states that the existing conversion service will re-check accepted status and duplicate-conversion state before creating anything;
- **Cancel conversion** closes the dialog without calling the conversion service or persisting a member link;
- confirming invokes the existing `convertJoinApplicationToMember` service and keeps the existing success and failure feedback;
- workflow-status changes, notes and contact-history behaviour are unchanged;
- the existing transaction, accepted-status requirement, duplicate-conversion guard and record-linking semantics remain authoritative;
- deterministic Playwright coverage uses the existing `TEST_flow_join_accepted` fixture, opens and cancels the confirmation, reloads the record, and proves **Create Member Record** remains available with no member created.

## Sixth slice — Leader Registration request decisions

The Leader Requests screen already separates request review from the list, but **Approve as Leader** and **Reject** previously executed their service calls immediately from that review dialog. Approval creates active section-scoped operational access; rejection closes the pending request and retains its review record.

This slice adds a consequence-focused final review for both decisions:

- **Approve as Leader** now opens an accessible **Approve leader access?** confirmation before the approval service runs;
- the confirmation identifies the applicant, names the requested section, and explains that an active section-scoped Leader account will be created with access to that section's leader data and workflows;
- **Reject** now opens an accessible **Reject leader request?** confirmation explaining that the request will close as Rejected and no leader access will be created from it;
- **Back to review** returns to the original review dialog with the review note intact and without persisting either decision;
- confirmed approval and rejection continue through the existing registration services, notification flow, audit event, success/error feedback and list refresh;
- approval's existing transactional pending-status check remains authoritative, and the administrator/Super Admin screen restriction is unchanged;
- deterministic Playwright coverage uses the existing `TEST_flow_leader_request_pending` fixture, reviews both decision confirmations, backs out of each, reloads, and proves the request remains Pending.

## Seventh slice — Parent Access approval and rejection

Parent Access already had an in-app confirmation for revocation, but **Approve Access** and **Reject Access** still executed the shared save path directly from each account card. Approval is high-impact because it grants parent-portal access to selected child records and linked sections and can associate existing consent records with those members. Rejection marks the request Rejected without granting access.

This slice brings both decisions onto the same review contract:

- **Approve Access** retains the existing requirement that at least one child is selected before a confirmation can open;
- the accessible **Approve parent access?** confirmation identifies the parent, reports the selected child count and affected sections, explains the resulting parent-portal access, and states that matching consent records may be linked;
- the confirmation repeats the existing identity-verification requirement before access is granted;
- **Reject Access** opens an accessible **Reject parent access?** confirmation explaining that the request will be marked Rejected, no child or section access will be granted, and unsaved child selection is not persisted;
- **Back to review** closes either confirmation without calling the save path, leaving the current on-screen child selection available for correction;
- confirmed approval and rejection still use the existing `linkConsentRecordsToMembers`, `updateParentAccess`, audit event, notifications, success/error feedback and reload behaviour;
- the existing revoke confirmation is unchanged;
- deterministic Playwright coverage uses the existing `TEST_flow_parent_pending` fixture, stages a Beavers child selection, backs out of both approval and rejection, reloads, and proves the account remains Pending with zero linked children.

## Eighth slice — Residual native feedback outside Badgework

The source-level close-out contract introduced after the seventh slice exposed six remaining browser-native calls. Four were outside Badgework and did not require any service or data-semantics change.

This slice removes those four:

- event gallery photo deletion replaces `window.confirm` with an accessible **Remove photo?** dialog that names the file, explains that the gallery file is deleted without changing the event record or attendance history, and keeps **Cancel** as a no-write path;
- blocked print windows on full consent records and event reports now use the pages' existing error alerts rather than `window.alert`;
- parent event-consent clipboard failure now opens an accessible **Copy parent consent link** dialog containing the exact read-only URL for manual copying instead of using `window.prompt`;
- existing gallery deletion, audit, print/export and public-link service semantics are unchanged;
- deterministic Playwright coverage verifies that a blocked event-report pop-up produces in-page error feedback without a browser-native alert.

## Ninth slice — Badgework native confirmations and close-out

The final two native calls were both in `BadgeworkTracking.tsx`. One guarded loss of unsaved competency draft changes when switching skill, stage or member-selection context. The other guarded removal of an existing stage award.

This slice replaces both with accessible application dialogs:

- changing skill, stage or members with unsaved draft changes opens **Discard unsaved badgework changes?** and explains that the draft will be discarded without writing to any member record;
- **Keep editing** closes that review and preserves the current draft and workflow context;
- **Discard and continue** clears only the unsaved draft and then performs the requested context change;
- stage-award removal opens **Remove stage award?**, identifies the stage and skill, and explicitly states that saved competency progress remains unchanged;
- **Cancel** leaves the awarded state untouched, while **Remove award** continues through the existing `setStageAwardForMembers` service path;
- the browser `beforeunload` safeguard for genuinely leaving the page with unsaved changes remains in place and is not treated as application-owned native dialog usage;
- deterministic Playwright coverage verifies both confirmation cancel paths without mutating the seeded award or draft state.

The source regression contract now requires zero browser-native `alert`, `confirm` or `prompt` calls under `src`.

## Stage 20.5 close-out status

Stage 20.5 is **complete**. The principal high-impact access, lifecycle, conversion, destructive and draft-loss actions reviewed by the stage now use consequence-focused in-app confirmation where appropriate, while routine saves, low-risk edits and reversible selection changes remain lightweight.

The close-out audit proved useful by finding six browser-native calls missed by the earlier source review. All six have now been migrated, and `tests/unit/actionConfirmationContract.test.ts` enforces a strict zero-native-dialog contract so future `alert`, `confirm` or `prompt` usage cannot silently re-enter application source.

## Preserved boundaries

These slices and the close-out contract do not alter:

- Firestore, Auth or Storage Rules;
- administrator and Super Admin role requirements;
- parent approval, rejection, revocation or child-linking service semantics;
- parent identity-verification guidance or the approval child-selection requirement;
- leader-access service validation or organisation/public projection semantics;
- Leader Registration service semantics, notification behaviour or audit event semantics;
- event lifecycle transition rules, close-out validation, event projections or completed-event read-only rules;
- member service validation, section permissions, lifecycle-history semantics or audit behaviour;
- Join Us workflow-status semantics, conversion transaction semantics, accepted-status validation, duplicate-conversion safeguards or member/enquiry linking;
- event gallery, consent printing, event reporting or event-consent link service semantics;
- Adventure Skills requirement persistence, stage-award semantics, provenance or source-link behaviour;
- parent-account, member, leader-access, organisation, event, Join Us or Leader Registration data models;
- deterministic seed contents;
- workflow security, provenance controls or branch-protection requirements;
- production data or the parked production TEST-data cleanup process.

## Next stage

Begin **Stage 20.6 — Mobile operational pass**. Review high-frequency leader journeys at narrow viewports first, prioritising fixed/sticky actions, multi-step dialogs, wide card/table content, long forms and expandable leader navigation. Preserve existing authorization, service behaviour, deterministic fixtures and Stage 18/19 operational controls while making mobile-only layout and interaction improvements.
